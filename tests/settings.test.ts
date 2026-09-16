import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, persistableSettings } from '../types';

describe('settings persistence', () => {
  it('defaults AI to Ollama', () => {
    expect(DEFAULT_SETTINGS.aiProvider).toBe('ollama');
    expect(DEFAULT_SETTINGS.geminiKey).toBe('');
  });

  it('never includes the Gemini key in persisted JSON', () => {
    const persisted = persistableSettings({
      ...DEFAULT_SETTINGS,
      geminiKey: 'sk-should-not-be-saved',
    });
    expect(persisted).not.toHaveProperty('geminiKey');
    expect(JSON.stringify(persisted)).not.toContain('sk-should-not-be-saved');
  });
});
