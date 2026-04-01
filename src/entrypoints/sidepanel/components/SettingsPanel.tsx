import { useState, useEffect, useCallback } from "react";
import {
  type AIProvider,
  type AIConfig,
  type ModelInfo,
  PROVIDER_INFO,
  getAIConfig,
  saveAIConfig,
  clearAIConfig,
  fetchModels,
} from "../../../lib/ai/config";

interface Props {
  onBack: () => void;
}

export function SettingsPanel({ onBack }: Props) {
  const [provider, setProvider] = useState<AIProvider>("groq");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [saved, setSaved] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  // Load existing config on mount
  useEffect(() => {
    getAIConfig().then((config) => {
      if (config) {
        setProvider(config.provider);
        setApiKey(config.apiKey);
        setModel(config.model);
        setHasExisting(true);
        // Fetch models for the existing config
        loadModels(config.provider, config.apiKey);
      }
    });
  }, []);

  const loadModels = useCallback(
    async (p: AIProvider, key: string) => {
      if (!key.trim()) {
        setModels([]);
        return;
      }

      setLoadingModels(true);
      setModelsError("");

      const fetched = await fetchModels(p, key);

      if (fetched.length === 0) {
        setModelsError("Could not fetch models. Check your API key.");
        setModels([]);
      } else {
        setModels(fetched);
        // Auto-select default model if current selection is not in the list
        const info = PROVIDER_INFO[p];
        setModel((prev) => {
          if (fetched.some((m) => m.id === prev)) return prev;
          const defaultMatch = fetched.find((m) => m.id === info.defaultModel);
          return defaultMatch ? defaultMatch.id : fetched[0]!.id;
        });
      }

      setLoadingModels(false);
    },
    [],
  );

  // Fetch models when provider changes (if we have a key)
  const handleProviderChange = (p: AIProvider) => {
    setProvider(p);
    setModel("");
    setModels([]);
    if (apiKey.trim()) {
      loadModels(p, apiKey);
    }
  };

  // Fetch models when API key is entered/changed (debounced)
  const [keyDebounce, setKeyDebounce] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    setSaved(false);

    if (keyDebounce) clearTimeout(keyDebounce);

    if (value.trim().length > 10) {
      setKeyDebounce(
        setTimeout(() => {
          loadModels(provider, value);
        }, 800),
      );
    } else {
      setModels([]);
      setModelsError("");
    }
  };

  const handleSave = async () => {
    if (!model && models.length > 0) {
      setModel(models[0]!.id);
    }
    const selectedModel =
      model || PROVIDER_INFO[provider].defaultModel;
    await saveAIConfig({ provider, apiKey, model: selectedModel });
    setSaved(true);
    setHasExisting(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = async () => {
    await clearAIConfig();
    setApiKey("");
    setModel("");
    setModels([]);
    setModelsError("");
    setHasExisting(false);
  };

  const info = PROVIDER_INFO[provider];
  const maskedKey = apiKey
    ? `${apiKey.slice(0, 6)}${"*".repeat(Math.max(0, apiKey.length - 10))}${apiKey.slice(-4)}`
    : "";

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-sm text-indigo-500 hover:text-indigo-600"
      >
        &larr; Back
      </button>

      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-slate-800 text-sm">AI Settings</h2>
        <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">
          Experimental
        </span>
      </div>
      <p className="text-xs text-slate-500">
        Configure an AI provider to enhance your reports with better naming,
        journey summaries, and product insights. This is optional — reports
        work without AI. AI features are experimental and results may vary.
      </p>

      {/* Provider selection */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Provider
        </label>
        <div className="flex gap-2">
          {(Object.keys(PROVIDER_INFO) as AIProvider[]).map((p) => (
            <button
              key={p}
              onClick={() => handleProviderChange(p)}
              className={`flex-1 py-2 px-3 text-xs rounded-lg border transition-colors ${
                provider === p
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-medium"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {PROVIDER_INFO[p].name}
            </button>
          ))}
        </div>
      </div>

      {/* API Key */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => handleApiKeyChange(e.target.value)}
          placeholder={`Enter your ${info.name} API key`}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
        />
        {hasExisting && apiKey && (
          <p className="text-xs text-slate-400 mt-1">Stored: {maskedKey}</p>
        )}
      </div>

      {/* Model selection */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Model
          {loadingModels && (
            <span className="ml-2 text-slate-400 font-normal">
              fetching...
            </span>
          )}
        </label>
        {models.length > 0 ? (
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.id === info.defaultModel ? " (recommended)" : ""}
              </option>
            ))}
          </select>
        ) : (
          <div className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-400 bg-slate-50">
            {loadingModels
              ? "Loading models..."
              : modelsError
                ? modelsError
                : "Enter an API key to load available models"}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!apiKey.trim() || models.length === 0}
          className="flex-1 py-2.5 px-4 bg-indigo-500 hover:bg-indigo-600 text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-40"
        >
          {saved ? "Saved!" : "Save"}
        </button>
        {hasExisting && (
          <button
            onClick={handleClear}
            className="py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 text-sm rounded-lg transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Privacy note */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
        <p className="text-xs text-slate-500">
          Your API key is stored locally in Chrome's extension storage and
          never sent anywhere except the selected provider's API. AI calls
          happen directly from your browser — no intermediary server.
        </p>
      </div>
    </div>
  );
}
