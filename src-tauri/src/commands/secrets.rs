// Track Your Shit - OS Keychain Secret Management Commands
// Provides secure API key storage via the native OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use keyring::Entry;
use serde::{Deserialize, Serialize};

/// Default service name for all Track Your Shit keychain entries
const DEFAULT_SERVICE: &str = "net.fluxlabs.track-your-shit";

/// Known/predefined secret key names that the UI offers as presets
const PREDEFINED_KEYS: &[&str] = &[
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "GITHUB_TOKEN",
    "OPENROUTER_API_KEY",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
];

/// In-memory index of stored secret keys, since the keyring crate
/// does not provide a "list all" API. We persist this index alongside
/// the secrets themselves using a special meta-key.
const KEY_INDEX_ENTRY: &str = "__track_your_shit_key_index__";

/// Serializable key index stored as a JSON array in the keychain
#[derive(Debug, Serialize, Deserialize, Default)]
struct KeyIndex {
    keys: Vec<String>,
}

impl KeyIndex {
    fn load(service: &str) -> Self {
        let entry = match Entry::new(service, KEY_INDEX_ENTRY) {
            Ok(e) => e,
            Err(_) => return Self::default(),
        };
        match entry.get_password() {
            Ok(json) => serde_json::from_str(&json).unwrap_or_default(),
            Err(_) => Self::default(),
        }
    }

    fn save(&self, service: &str) -> Result<(), String> {
        let entry = Entry::new(service, KEY_INDEX_ENTRY)
            .map_err(|e| format!("Failed to create keychain entry for index: {}", e))?;
        let json = serde_json::to_string(&self)
            .map_err(|e| format!("Failed to serialize key index: {}", e))?;
        entry
            .set_password(&json)
            .map_err(|e| format!("Failed to save key index to keychain: {}", e))?;
        Ok(())
    }

    fn add_key(&mut self, key: &str) {
        if !self.keys.iter().any(|k| k == key) {
            self.keys.push(key.to_string());
        }
    }

    fn remove_key(&mut self, key: &str) {
        self.keys.retain(|k| k != key);
    }
}

/// Store a secret in the OS keychain.
///
/// # Arguments
/// * `service` - Keychain service name (use "net.fluxlabs.track-your-shit")
/// * `key` - The secret key name (e.g., "ANTHROPIC_API_KEY")
/// * `value` - The secret value to store
#[tauri::command]
pub async fn set_secret(service: String, key: String, value: String) -> Result<(), String> {
    let svc = if service.is_empty() {
        DEFAULT_SERVICE.to_string()
    } else {
        service
    };

    // Validate inputs
    if key.is_empty() {
        return Err("Secret key cannot be empty".to_string());
    }
    if value.is_empty() {
        return Err("Secret value cannot be empty".to_string());
    }
    if key == KEY_INDEX_ENTRY {
        return Err("Reserved key name".to_string());
    }

    // Store the secret
    let entry = Entry::new(&svc, &key)
        .map_err(|e| format!("Failed to create keychain entry: {}", e))?;
    entry
        .set_password(&value)
        .map_err(|e| format!("Failed to store secret in keychain: {}", e))?;

    // Update the key index
    let mut index = KeyIndex::load(&svc);
    index.add_key(&key);
    index.save(&svc)?;

    tracing::info!("Stored secret '{}' in OS keychain (service: {})", key, svc);
    Ok(())
}

/// Retrieve a secret from the OS keychain.
///
/// Returns `None` if the key doesn't exist (rather than an error).
#[tauri::command]
pub async fn get_secret(service: String, key: String) -> Result<Option<String>, String> {
    let svc = if service.is_empty() {
        DEFAULT_SERVICE.to_string()
    } else {
        service
    };

    if key.is_empty() {
        return Err("Secret key cannot be empty".to_string());
    }

    let entry = Entry::new(&svc, &key)
        .map_err(|e| format!("Failed to create keychain entry: {}", e))?;

    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to retrieve secret from keychain: {}", e)),
    }
}

/// Delete a secret from the OS keychain.
#[tauri::command]
pub async fn delete_secret(service: String, key: String) -> Result<(), String> {
    let svc = if service.is_empty() {
        DEFAULT_SERVICE.to_string()
    } else {
        service
    };

    if key.is_empty() {
        return Err("Secret key cannot be empty".to_string());
    }
    if key == KEY_INDEX_ENTRY {
        return Err("Cannot delete reserved key".to_string());
    }

    let entry = Entry::new(&svc, &key)
        .map_err(|e| format!("Failed to create keychain entry: {}", e))?;

    match entry.delete_credential() {
        Ok(()) => {}
        Err(keyring::Error::NoEntry) => {
            // Not an error if it doesn't exist
        }
        Err(e) => {
            return Err(format!("Failed to delete secret from keychain: {}", e));
        }
    }

    // Update the key index
    let mut index = KeyIndex::load(&svc);
    index.remove_key(&key);
    index.save(&svc)?;

    tracing::info!(
        "Deleted secret '{}' from OS keychain (service: {})",
        key,
        svc
    );
    Ok(())
}

/// List all stored secret key names (not values) for a given service.
///
/// Uses an internal key index since the keyring crate doesn't support enumeration.
/// Also validates that listed keys still exist in the keychain.
#[tauri::command]
pub async fn list_secret_keys(service: String) -> Result<Vec<String>, String> {
    let svc = if service.is_empty() {
        DEFAULT_SERVICE.to_string()
    } else {
        service
    };

    let index = KeyIndex::load(&svc);

    // Validate each key still exists and remove stale entries
    let mut valid_keys = Vec::new();
    let mut needs_cleanup = false;

    for key in &index.keys {
        let entry = match Entry::new(&svc, key) {
            Ok(e) => e,
            Err(_) => {
                needs_cleanup = true;
                continue;
            }
        };
        match entry.get_password() {
            Ok(_) => valid_keys.push(key.clone()),
            Err(keyring::Error::NoEntry) => {
                needs_cleanup = true;
            }
            Err(_) => {
                // Keep the key in the list even if we can't read it
                // (could be a permissions issue)
                valid_keys.push(key.clone());
            }
        }
    }

    // If stale keys were found, update the index
    if needs_cleanup {
        let updated_index = KeyIndex {
            keys: valid_keys.clone(),
        };
        let _ = updated_index.save(&svc);
    }

    Ok(valid_keys)
}

/// Returns the list of predefined/well-known secret key names.
#[tauri::command]
pub async fn get_predefined_secret_keys() -> Result<Vec<String>, String> {
    Ok(PREDEFINED_KEYS.iter().map(|s| s.to_string()).collect())
}

/// Check if a specific secret exists in the keychain without retrieving its value.
#[tauri::command]
pub async fn has_secret(service: String, key: String) -> Result<bool, String> {
    let svc = if service.is_empty() {
        DEFAULT_SERVICE.to_string()
    } else {
        service
    };

    if key.is_empty() {
        return Err("Secret key cannot be empty".to_string());
    }

    let entry = Entry::new(&svc, &key)
        .map_err(|e| format!("Failed to create keychain entry: {}", e))?;

    match entry.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(format!("Failed to check secret in keychain: {}", e)),
    }
}
