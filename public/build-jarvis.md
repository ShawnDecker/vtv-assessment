# Build Jarvis — Stack Manifest for Cameron

Everything that runs behind Shawn's Jarvis. All open-source except where noted;
no API keys required on the default path. One-machine install — no cloud services
have to be provisioned.

Total disk footprint: **~10 GB** after model pulls. RAM: 8 GB OK, 16 GB comfortable.
Works on CPU alone — no GPU required.

---

## 1. Operating system + runtime

| Need | Why |
|---|---|
| Windows 10 or 11 (64-bit) | What the daemon is tested on. Linux works with minor path edits. |
| Python **3.12** (NOT 3.13 or 3.14) | ML wheels lag the newest Python. Use `py -3.12`. |
| Python venv | Keep jarvis deps isolated from system Python. |

```powershell
py -3.12 -m venv C:\Users\Cameron\jarvis\.venv
C:\Users\Cameron\jarvis\.venv\Scripts\activate
python -m pip install -U pip
```

---

## 2. Python packages (one `pip install` line)

```powershell
pip install openwakeword faster-whisper sounddevice numpy pynput piper-tts ^
            pyyaml onnxruntime edge-tts python-docx pypdf chardet psutil ^
            beautifulsoup4 psycopg[binary]
```

| Package | Role | License |
|---|---|---|
| **openwakeword** | "Hey Jarvis" wake-word detection, ONNX runtime | MIT |
| **faster-whisper** | Speech-to-text, CTranslate2 backend | MIT |
| **edge-tts** | Microsoft Azure neural voices (free, no key) — primary TTS | Apache 2.0 |
| **piper-tts** | Offline TTS fallback (optional) | MIT |
| **sounddevice** | Audio I/O (PortAudio wrapper) | MIT |
| **pynput** | Keystroke injection, global hotkeys (no admin) | LGPL 3.0 |
| **numpy** | Numerical ops, embedding vectors | BSD |
| **pyyaml** | Config files | MIT |
| **onnxruntime** | Runs the openwakeword ONNX model | MIT |
| **python-docx** | Read .docx files for knowledge index | MIT |
| **pypdf** | Read PDFs for knowledge index | BSD |
| **chardet** | Text encoding detection | LGPL |
| **psutil** | Battery, CPU, RAM status tool | BSD |
| **beautifulsoup4** | Parse web pages for fetch/search tools | MIT |
| **psycopg[binary]** | Postgres/Neon DB access (only if you want DB tools) | LGPL |

---

## 3. Local AI — Ollama

Install: <https://ollama.com/download/windows>

After Ollama is running (it auto-starts), pull the models:

```powershell
ollama pull qwen3:8b          # ~5.2 GB — main reasoning + SQL gen
ollama pull nomic-embed-text  # ~275 MB — vector embeddings
```

Optional additional models (any subset):

```powershell
ollama pull phi4-mini:latest  # ~2.5 GB — fastest butler replies
ollama pull gemma3:4b         # ~3.3 GB — alternate reasoning
```

All run on CPU. Ollama exposes `http://localhost:11434` — Jarvis talks to it there.

---

## 4. Speech models (auto-download on first run, no manual step)

| Model | Size | What it does | Cost |
|---|---|---|---|
| `hey_jarvis_v0.1.onnx` | 1.3 MB | Wake-word (pre-trained) | Free |
| Whisper `small.en` | 480 MB | Voice → text | Free |
| Ollama `nomic-embed-text` | 275 MB | Text → 768-dim vectors | Free |
| Ollama `qwen3:8b` | 5.2 GB | Reasoning, butler replies | Free |
| Edge-TTS `en-GB-RyanNeural` | 0 MB (cloud) | Text → British male voice | Free, needs internet |

---

## 5. The 15 Python source files

Drop these in `C:\Users\Cameron\jarvis\`:

| File | What it does |
|---|---|
| `jarvis.py` | Main daemon — mic loop, wake word, state machine, routing |
| `commands.py` | Phrase → keystroke map (Enter, Esc, plan-mode approvals) |
| `voice.py` | TTS wrapper (Edge-TTS primary, Piper fallback) |
| `llm.py` | Ollama client, butler system prompt, streaming, history |
| `tools.py` | All non-keystroke voice tools (40+ handlers) |
| `context.py` | Loads memory files + Obsidian HOME into LLM prompt |
| `knowledge.py` | SQLite vector index + cosine-sim search |
| `memory.py` | Long-term "remember X" / "recall X" persistent memory |
| `web.py` | DuckDuckGo + Bing search, URL fetch, Wikipedia |
| `shell.py` | Whitelisted read-only shell commands + file read |
| `scenes.py` | "Load my X workspace" — multi-app launcher |
| `proposals.py` | Overnight design-proposal generator |
| `overnight_worker.py` | Scheduled indexer + proposal orchestrator |
| `config.yaml` | All tunables (voice, thresholds, hotkeys, LLM, SFX) |
| `scenes.yaml` | Workspace definitions |
| `crawl_config.yaml` | Overnight whitelist + project list |

---

## 6. Windows-native wiring (no extra install)

- **Windows Task Scheduler** — overnight job runs at 11 pm / 2 am / 5 am
- **Windows Startup folder** — `shell:startup` shortcut auto-launches on login
- **PowerShell** — used for app launching and task registration

---

## 7. Optional — database access

Only if Cameron wants Jarvis to answer "how many users" style questions from his own Postgres / Neon:

1. Have his DB URL handy (`postgresql://user:pass@host/db?sslmode=require`)
2. Run `setup_db_role.py` once — it creates a read-only `jarvis_ro` role, grants SELECT only, verifies writes are blocked at the Postgres level, snapshots the schema to `db_schema.json`
3. Voice queries like *"how many members"* will then return a live count

Skip if not needed — everything else works without it.

---

## 8. What Cameron does NOT need

- No OpenAI / Anthropic API key
- No Azure / Google Cloud account
- No microcontroller, Arduino, or sensor hardware
- No GPU
- No Docker (can containerize later if desired)
- No ElevenLabs / paid TTS subscription

---

## 9. First-run checklist

1. ☐ Install Python 3.12
2. ☐ Create venv at `C:\Users\Cameron\jarvis\.venv`
3. ☐ `pip install` the package list from Section 2
4. ☐ Install Ollama, pull `qwen3:8b` and `nomic-embed-text`
5. ☐ Copy the 15 Python files to `C:\Users\Cameron\jarvis\`
6. ☐ Edit `config.yaml` paths if username differs
7. ☐ Edit `crawl_config.yaml` to point at Cameron's project directories
8. ☐ Edit `scenes.yaml` for Cameron's workspaces (optional)
9. ☐ Run once: `python jarvis.py --test-tts` — verify voice works
10. ☐ Run once: `python jarvis.py --test-wake` — say "Hey Jarvis", verify wake detection
11. ☐ Register Startup shortcut + Scheduled Task (scripts in repo)
12. ☐ (Optional) Run `setup_db_role.py` to wire Postgres

That's the whole stack, sir.
