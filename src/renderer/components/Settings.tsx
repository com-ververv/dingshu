/**
 * Settings Component
 *
 * Configuration panel for database location and app info.
 */

import React, { useState, useEffect } from 'react';
import './Settings.css';
import {
  DatabaseInfo,
  SecureSettingsStatus,
  LarkAuthStartResult,
  LarkCapabilityInfo,
  LarkCliInfo,
} from '../../types/window';

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'ai' | 'lark' | 'storage' | 'about'>('ai');

  // Database location state
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ success: boolean; message: string } | null>(null);
  const [secureStatus, setSecureStatus] = useState<SecureSettingsStatus | null>(null);
  const [siliconflowApiKey, setSiliconflowApiKey] = useState('');
  const [larkAppId, setLarkAppId] = useState('');
  const [larkAppSecret, setLarkAppSecret] = useState('');
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [credentialResult, setCredentialResult] = useState<{ success: boolean; message: string } | null>(null);
  const [authResult, setAuthResult] = useState<LarkAuthStartResult | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [larkCliInfo, setLarkCliInfo] = useState<LarkCliInfo | null>(null);
  const [larkCapabilities, setLarkCapabilities] = useState<LarkCapabilityInfo[]>([]);

  // App version
  const [appVersion, setAppVersion] = useState<string>('...');

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      // Load database info
      const dbInfoResult = await window.api.database.getInfo();
      if (dbInfoResult.success && dbInfoResult.data) {
        setDbInfo(dbInfoResult.data);
      }

      // Load app version
      const versionResult = await window.api.app.getVersion();
      if (versionResult.success && versionResult.data) {
        setAppVersion(versionResult.data);
      }

      await loadSecureStatus();
      await loadLarkCliInfo();
      await loadLarkCapabilities();
    };
    loadSettings();
  }, []);

  const loadSecureStatus = async () => {
    const statusResult = await window.api.secureSettings.getStatus();
    if (statusResult.success && statusResult.data) {
      setSecureStatus(statusResult.data);
    }
  };

  const loadLarkCliInfo = async () => {
    const result = await window.api.larkCli.getInfo();
    if (result.success && result.data) {
      setLarkCliInfo(result.data);
    }
  };

  const loadLarkCapabilities = async () => {
    const result = await window.api.larkCli.listCapabilities();
    if (result.success && result.data) {
      setLarkCapabilities(result.data);
    }
  };

  const capabilitySummary = {
    read: larkCapabilities.filter((capability) => capability.risk === 'read').length,
    write: larkCapabilities.filter((capability) => capability.risk === 'write').length,
  };

  const handleSaveCredentials = async () => {
    setSavingCredentials(true);
    setCredentialResult(null);
    try {
      const result = await window.api.secureSettings.saveCredentials({
        larkAppId,
        larkAppSecret,
        siliconflowApiKey,
      });
      if (result.success) {
        setCredentialResult({ success: true, message: '凭证已安全保存。' });
        setSiliconflowApiKey('');
        setLarkAppId('');
        setLarkAppSecret('');
        await loadSecureStatus();
      } else {
        setCredentialResult({ success: false, message: result.error?.message ?? '保存失败。' });
      }
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleStartLarkAuth = async () => {
    setAuthBusy(true);
    setAuthResult(null);
    try {
      const result = await window.api.larkAuth.start('docs,drive,im');
      if (result.success && result.data) {
        setAuthResult(result.data);
        if (result.data.verificationUrl) {
          await window.api.shell.openExternal(result.data.verificationUrl);
        }
      } else {
        setCredentialResult({ success: false, message: result.error?.message ?? '启动飞书授权失败。' });
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCompleteLarkAuth = async () => {
    if (!authResult?.deviceCode) {
      return;
    }
    setAuthBusy(true);
    try {
      const result = await window.api.larkAuth.complete(authResult.deviceCode);
      if (result.success) {
        setCredentialResult({ success: true, message: '飞书授权已完成。' });
        setAuthResult(null);
        await loadSecureStatus();
      } else {
        setCredentialResult({ success: false, message: result.error?.message ?? '完成飞书授权失败。' });
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleMigrateToDocuments = async () => {
    if (!dbInfo?.isLegacyLocation) {
      setMigrationResult({ success: false, message: 'Database is already in Documents folder.' });
      return;
    }

    setMigrating(true);
    setMigrationResult(null);

    try {
      const result = await window.api.database.migrateToDocuments();
      if (result.success && result.data) {
        setMigrationResult({
          success: true,
          message: `Database moved successfully! New location: ${result.data.newPath}`,
        });
        // Refresh database info
        const dbInfoResult = await window.api.database.getInfo();
        if (dbInfoResult.success && dbInfoResult.data) {
          setDbInfo(dbInfoResult.data);
        }
      } else {
        setMigrationResult({
          success: false,
          message: result.error?.message || 'Migration failed.',
        });
      }
    } catch {
      setMigrationResult({ success: false, message: 'Failed to migrate database.' });
    } finally {
      setMigrating(false);
    }
  };

  const handleShowInFinder = async () => {
    await window.api.database.showInFinder();
  };

  const handleSelectExisting = async () => {
    setMigrationResult(null);

    try {
      const result = await window.api.database.selectExisting();
      if (result.success && result.data) {
        setMigrationResult({
          success: true,
          message: `Database switched! Now using: ${result.data.newPath}. Please restart the app for changes to take full effect.`,
        });
        // Refresh database info
        const dbInfoResult = await window.api.database.getInfo();
        if (dbInfoResult.success && dbInfoResult.data) {
          setDbInfo(dbInfoResult.data);
        }
      } else if (result.error?.code !== 'CANCELLED') {
        setMigrationResult({
          success: false,
          message: result.error?.message || 'Failed to select database.',
        });
      }
    } catch {
      setMigrationResult({ success: false, message: 'Failed to select database.' });
    }
  };

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="close-button" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            AI
          </button>
          <button
            className={`settings-tab ${activeTab === 'lark' ? 'active' : ''}`}
            onClick={() => setActiveTab('lark')}
          >
            Lark
          </button>
          <button
            className={`settings-tab ${activeTab === 'storage' ? 'active' : ''}`}
            onClick={() => setActiveTab('storage')}
          >
            Storage
          </button>
          <button
            className={`settings-tab ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            About
          </button>
        </div>

        <div className="settings-content">
          {activeTab === 'ai' && (
            <section className="settings-section">
              <h3>SiliconFlow</h3>
              <p className="section-description">API Key 会通过 Electron safeStorage 加密后保存到本地数据库。</p>
              <div className={`db-status ${secureStatus?.safeStorageAvailable ? 'success' : 'warning'}`}>
                <span className="status-icon">{secureStatus?.safeStorageAvailable ? 'OK' : '!'}</span>
                <span>{secureStatus?.safeStorageAvailable ? 'safeStorage 可用' : 'safeStorage 不可用，无法保存凭证'}</span>
              </div>
              <div className="credential-row">
                <span>API Key</span>
                <span className={secureStatus?.siliconflowApiKeyConfigured ? 'configured' : 'not-configured'}>
                  {secureStatus?.siliconflowApiKeyConfigured ? '已配置' : '未配置'}
                </span>
              </div>
              <input
                type="password"
                value={siliconflowApiKey}
                onChange={(event) => setSiliconflowApiKey(event.target.value)}
                placeholder="输入新的 SiliconFlow API Key"
                disabled={!secureStatus?.safeStorageAvailable}
              />
              <button
                className="primary-button settings-action"
                onClick={handleSaveCredentials}
                disabled={savingCredentials || !secureStatus?.safeStorageAvailable || !siliconflowApiKey.trim()}
              >
                {savingCredentials ? '保存中...' : '保存 API Key'}
              </button>
              {credentialResult && <div className={`test-result ${credentialResult.success ? 'success' : 'error'}`}>{credentialResult.message}</div>}
            </section>
          )}

          {activeTab === 'lark' && (
            <section className="settings-section">
              <h3>Feishu / Lark</h3>
              <p className="section-description">appId / appSecret 会加密保存；用户授权由 lark-cli 设备码流程完成。</p>
              <div className="credential-grid">
                <div className="credential-row">
                  <span>App ID</span>
                  <span className={secureStatus?.larkAppIdConfigured ? 'configured' : 'not-configured'}>
                    {secureStatus?.larkAppIdConfigured ? '已配置' : '未配置'}
                  </span>
                </div>
                <input
                  type="password"
                  value={larkAppId}
                  onChange={(event) => setLarkAppId(event.target.value)}
                  placeholder="输入飞书 appId"
                  disabled={!secureStatus?.safeStorageAvailable}
                />
                <div className="credential-row">
                  <span>App Secret</span>
                  <span className={secureStatus?.larkAppSecretConfigured ? 'configured' : 'not-configured'}>
                    {secureStatus?.larkAppSecretConfigured ? '已配置' : '未配置'}
                  </span>
                </div>
                <input
                  type="password"
                  value={larkAppSecret}
                  onChange={(event) => setLarkAppSecret(event.target.value)}
                  placeholder="输入飞书 appSecret"
                  disabled={!secureStatus?.safeStorageAvailable}
                />
              </div>
              <button
                className="primary-button settings-action"
                onClick={handleSaveCredentials}
                disabled={savingCredentials || !secureStatus?.safeStorageAvailable || (!larkAppId.trim() && !larkAppSecret.trim())}
              >
                {savingCredentials ? '保存中...' : '保存飞书凭证'}
              </button>
              <div className="auth-section">
                <div className={`db-status ${larkCliInfo?.ok ? 'success' : 'warning'}`}>
                  <span className="status-icon">{larkCliInfo?.ok ? 'OK' : '!'}</span>
                  <span>{larkCliInfo?.ok ? 'lark-cli 可用' : 'lark-cli 不可用'}</span>
                </div>
                {larkCliInfo ? (
                  <div className="cli-info">
                    <label>Executable</label>
                    <code>{larkCliInfo.executable}</code>
                    {larkCliInfo.sha256 ? (
                      <>
                        <label>SHA-256</label>
                        <code>{larkCliInfo.sha256}</code>
                      </>
                    ) : null}
                  </div>
                ) : null}
                <div className="capability-summary">
                  <div>
                    <strong>{larkCapabilities.length}</strong>
                    <span>已登记能力</span>
                  </div>
                  <div>
                    <strong>{capabilitySummary.read}</strong>
                    <span>只读</span>
                  </div>
                  <div>
                    <strong>{capabilitySummary.write}</strong>
                    <span>需确认</span>
                  </div>
                </div>
                <button className="btn-secondary" onClick={handleStartLarkAuth} disabled={authBusy}>
                  {authBusy ? '处理中...' : '开始飞书授权'}
                </button>
                {authResult?.verificationUrl ? (
                  <div className="auth-result">
                    <label>授权链接</label>
                    <code>{authResult.verificationUrl}</code>
                    {authResult.userCode ? <p>验证码：{authResult.userCode}</p> : null}
                    <button className="primary-button" onClick={handleCompleteLarkAuth} disabled={authBusy}>
                      我已完成授权
                    </button>
                  </div>
                ) : null}
              </div>
              {credentialResult && <div className={`test-result ${credentialResult.success ? 'success' : 'error'}`}>{credentialResult.message}</div>}
            </section>
          )}

          {activeTab === 'storage' && (
            <section className="settings-section">
              <h3>Database Location</h3>
              <p className="section-description">
                Your data is stored in a local SQLite database. Moving it to Documents enables cloud sync across
                devices.
              </p>

              {dbInfo && (
                <div className="database-info">
                  <div className="db-path-display">
                    <label>Current Location:</label>
                    <code className="db-path">{dbInfo.currentPath}</code>
                    <button className="btn-secondary btn-small" onClick={handleShowInFinder}>
                      Show in Finder
                    </button>
                  </div>

                  <div className={`db-status ${dbInfo.isLegacyLocation ? 'warning' : 'success'}`}>
                    {dbInfo.isLegacyLocation ? (
                      <>
                        <span className="status-icon">!</span>
                        <span>Database is in Application Support (not synced)</span>
                      </>
                    ) : (
                      <>
                        <span className="status-icon">OK</span>
                        <span>Database is in Documents folder</span>
                      </>
                    )}
                  </div>

                  {dbInfo.isLegacyLocation && (
                    <div className="migration-section">
                      <h4>Move to Documents Folder</h4>
                      <p className="migration-description">
                        This will copy your database to the Documents folder. Your existing data will be preserved.
                      </p>

                      <button className="primary-button" onClick={handleMigrateToDocuments} disabled={migrating}>
                        {migrating ? 'Moving Database...' : 'Move to Documents'}
                      </button>
                    </div>
                  )}

                  <div className="migration-section">
                    <h4>Use Existing Database</h4>
                    <p className="migration-description">
                      Connect to an existing database file from another device or backup.
                    </p>

                    <button className="btn-secondary" onClick={handleSelectExisting}>
                      Select Database File...
                    </button>
                  </div>

                  {migrationResult && (
                    <div className={`test-result ${migrationResult.success ? 'success' : 'error'}`}>
                      {migrationResult.message}
                    </div>
                  )}
                </div>
              )}

              {!dbInfo && <p className="loading-text">Loading database information...</p>}
            </section>
          )}

          {activeTab === 'about' && (
            <section className="settings-section about-section">
              <h3>About</h3>
              <p className="about-text">
                Desktop Starter App is a template for building production-ready Electron applications with React and
                TypeScript.
              </p>
              <p className="version-text">Version {appVersion}</p>
              <div className="about-links">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    window.api.shell.openExternal(`https://github.com/${__APP_CONFIG__.github.owner}/${__APP_CONFIG__.github.repo}`);
                  }}
                >
                  GitHub Repository
                </a>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
