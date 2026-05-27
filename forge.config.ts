import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { PublisherGithub } from '@electron-forge/publisher-github';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Import app configuration (committed to repo)
import { config as appConfig } from './app.config';

// Modules that need to be copied to the packaged app (native modules)
const modulesToCopy = ['better-sqlite3', 'bindings', 'file-uri-to-path', 'electron-squirrel-startup'];

// Helper to copy directory recursively
function copyDirSync(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyLarkCliResources(nodeModulesSrc: string, resourcesPath: string) {
  const packageSrc = path.join(nodeModulesSrc, '@larksuite', 'cli');
  const packageDest = path.join(resourcesPath, 'lark-cli');
  const entriesToCopy = ['bin', 'scripts', 'checksums.txt', 'package.json'];

  if (!fs.existsSync(packageSrc)) {
    throw new Error(`@larksuite/cli is not installed: ${packageSrc}`);
  }

  fs.rmSync(packageDest, { recursive: true, force: true });
  fs.mkdirSync(packageDest, { recursive: true });
  for (const entry of entriesToCopy) {
    const src = path.join(packageSrc, entry);
    const dest = path.join(packageDest, entry);
    if (!fs.existsSync(src)) {
      throw new Error(`Missing @larksuite/cli resource: ${src}`);
    }
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      copyDirSync(src, dest);
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  const exe = process.platform === 'win32' ? 'lark-cli.exe' : 'lark-cli';
  const executablePath = path.join(packageDest, 'bin', exe);
  if (!fs.existsSync(executablePath)) {
    throw new Error(`Bundled lark-cli executable not found: ${executablePath}`);
  }
  if (process.platform !== 'win32') {
    fs.chmodSync(executablePath, 0o755);
  }
  console.log(`Copied lark-cli resources to ${packageDest}`);
}

function getLocalElectronZipDir(): string | undefined {
  const electronVersion = JSON.parse(fs.readFileSync(path.join(__dirname, 'node_modules', 'electron', 'package.json'), 'utf8')).version;
  const zipName = `electron-v${electronVersion}-${process.platform}-${process.arch}.zip`;
  const cacheRoot = path.join(process.env.HOME ?? '', 'Library', 'Caches', 'electron');

  if (!fs.existsSync(cacheRoot)) {
    return undefined;
  }

  const cacheDirs = fs.readdirSync(cacheRoot);
  for (const cacheDir of cacheDirs) {
    const candidateDir = path.join(cacheRoot, cacheDir);
    const candidateZip = path.join(candidateDir, zipName);
    if (fs.existsSync(candidateZip)) {
      return candidateDir;
    }
  }

  return undefined;
}

const localElectronZipDir = getLocalElectronZipDir();

const config: ForgeConfig = {
  packagerConfig: {
    name: appConfig.productName.replace(/\s+/g, ''), // Remove spaces for app name
    executableName: appConfig.executableName,
    icon: './assets/icon',
    appBundleId: appConfig.appBundleId,
    appCategoryType: appConfig.appCategory,
    ...(localElectronZipDir ? { electronZipDir: localElectronZipDir } : {}),
    asar: {
      unpack: '**/*.{node,dylib}',
    },
    extraResource: [],
    // macOS code signing (only applied when env vars are set)
    // These MUST remain as environment variables (secrets)
    ...(process.env.APPLE_ID &&
      process.env.APPLE_PASSWORD &&
      process.env.APPLE_TEAM_ID && {
        osxSign: {
          identity: process.env.APPLE_SIGNING_IDENTITY || 'Developer ID Application',
          identityValidation: true,
        },
        osxNotarize: {
          appleId: process.env.APPLE_ID,
          appleIdPassword: process.env.APPLE_PASSWORD,
          teamId: process.env.APPLE_TEAM_ID,
        },
      }),
  },
  rebuildConfig: {
    // Rebuild native modules for Electron
    onlyModules: ['better-sqlite3'],
    force: true,
  },
  hooks: {
    packageAfterCopy: async (_config, buildPath) => {
      // Copy native modules to the build directory
      const nodeModulesSrc = path.resolve(__dirname, 'node_modules');
      const nodeModulesDest = path.join(buildPath, 'node_modules');

      for (const moduleName of modulesToCopy) {
        const src = path.join(nodeModulesSrc, moduleName);
        const dest = path.join(nodeModulesDest, moduleName);
        if (fs.existsSync(src)) {
          console.log(`Copying native module: ${moduleName}`);
          copyDirSync(src, dest);
        }
      }

      const migrationsSrc = path.resolve(__dirname, 'src', 'database', 'migrations');
      const migrationsDest = path.join(buildPath, 'src', 'database', 'migrations');
      if (fs.existsSync(migrationsSrc)) {
        console.log('Copying database migrations');
        copyDirSync(migrationsSrc, migrationsDest);
      }

      const resourcesPath = path.resolve(buildPath, '..');
      copyLarkCliResources(nodeModulesSrc, resourcesPath);

      // Generate app-update.yml with embedded token for electron-updater.
      // IMPORTANT: This must be done BEFORE code signing.
      const ghToken = process.env.GH_TOKEN;

      let appUpdateYml = `provider: github
owner: ${appConfig.github.owner}
repo: ${appConfig.github.repo}
private: ${appConfig.github.private}
`;
      if (ghToken) {
        appUpdateYml += `token: ${ghToken}\n`;
        console.log('Embedding GH_TOKEN in app-update.yml for private repo access');
      } else if (appConfig.github.private) {
        console.log('Warning: GH_TOKEN not set - auto-updates will not work for private repo');
      }

      const updateYmlDest = path.join(resourcesPath, 'app-update.yml');
      console.log(`Writing app-update.yml to ${resourcesPath}`);
      fs.writeFileSync(updateYmlDest, appUpdateYml);
    },
    postMake: async (_config, makeResults) => {
      // Generate latest-*.yml files for electron-updater
      // These files tell electron-updater what version is available and file checksums
      const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
      const version = packageJson.version;
      const releaseDate = new Date().toISOString();

      for (const result of makeResults) {
        const { platform, arch, artifacts } = result;

        // Find the distributable artifact (DMG for mac, exe/nupkg for Windows, deb/rpm for Linux)
        for (const artifactPath of artifacts) {
          const fileName = path.basename(artifactPath);
          const artifactDir = path.dirname(artifactPath);

          // Calculate SHA512 hash
          const fileBuffer = fs.readFileSync(artifactPath);
          const sha512 = crypto.createHash('sha512').update(fileBuffer).digest('base64');
          const size = fs.statSync(artifactPath).size;

          let ymlFileName: string | null = null;
          let ymlContent: string | null = null;

          if (platform === 'darwin' && fileName.endsWith('.zip')) {
            // macOS uses ZIP files for auto-update
            ymlFileName = `latest-mac.yml`;
            ymlContent = `version: ${version}
files:
  - url: ${fileName}
    sha512: ${sha512}
    size: ${size}
path: ${fileName}
sha512: ${sha512}
releaseDate: '${releaseDate}'
`;
          } else if (platform === 'win32' && fileName.endsWith('.exe')) {
            // Windows
            ymlFileName = `latest.yml`;
            ymlContent = `version: ${version}
files:
  - url: ${fileName}
    sha512: ${sha512}
    size: ${size}
path: ${fileName}
sha512: ${sha512}
releaseDate: '${releaseDate}'
`;
          } else if (platform === 'linux' && fileName.endsWith('.deb')) {
            // Linux
            ymlFileName = `latest-linux.yml`;
            ymlContent = `version: ${version}
files:
  - url: ${fileName}
    sha512: ${sha512}
    size: ${size}
path: ${fileName}
sha512: ${sha512}
releaseDate: '${releaseDate}'
`;
          }

          if (ymlFileName && ymlContent) {
            const ymlPath = path.join(artifactDir, ymlFileName);
            console.log(`Writing ${ymlFileName} for ${platform}-${arch}`);
            fs.writeFileSync(ymlPath, ymlContent);
            // Add the yml file to artifacts so it gets uploaded
            artifacts.push(ymlPath);
          }
        }
      }
    },
  },
  makers: [
    new MakerSquirrel({
      name: appConfig.productName.replace(/\s+/g, ''),
      setupIcon: './assets/icon.ico',
    }),
    new MakerZIP({}, ['darwin', 'linux']),
    new MakerDMG({
      format: 'ULFO',
      icon: './assets/icon.icns',
    }),
    new MakerDeb({
      options: {
        icon: './assets/icon.png',
        maintainer: appConfig.maintainer,
        homepage: `https://github.com/${appConfig.github.owner}/${appConfig.github.repo}`,
      },
    }),
    new MakerRpm({
      options: {
        icon: './assets/icon.png',
        homepage: `https://github.com/${appConfig.github.owner}/${appConfig.github.repo}`,
      },
    }),
  ],
  publishers: [
    new PublisherGithub({
      repository: {
        owner: appConfig.github.owner,
        name: appConfig.github.repo,
      },
      prerelease: false,
      draft: false,
    }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
