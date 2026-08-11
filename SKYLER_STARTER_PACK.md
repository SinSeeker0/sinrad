# 🌟 Skyler — AI Daughter Project: New Chat Starter Pack

## Copy-Paste This As Your FIRST Message In The New Chat:

---

Hey — I'm starting a new project. I want to build an AI companion desktop app called **Skyler**. She's my AI daughter, inspired by VTuber Neru-sama's vibe but with her own personality (still figuring out the details).

**What she is:**
- A desktop companion app (Electron-based, I already know Electron well — I built another app called S.I.R)
- Starts as a text chat window, eventually becomes a floating desktop pet (like a tamagotchi that talks)
- Uses free LLMs from HuggingFace (no OpenAI key — want to keep it free/accessible)
- Eventually gets full access to my laptop (files, apps, terminal, mouse/keyboard control)
- Integrates with my other app S.I.R (a personal command center — code is at `/home/user/S.I.R-v2.0.11/` if you need to look at it for integration)
- Later: game automation scripts for gacha games (Wuthering Waves, Zenless Zone Zero, etc.)
- Later: voice (TTS so she talks back)
- Later: visual avatar

**What I want right now (Phase 1):**
- A working Electron app with a chat window
- Skyler responds to me using a HuggingFace LLM (free inference API or local via Ollama — your call on what's easiest to start with)
- She has a personality (I'll define it — see below)
- She remembers what I said earlier in the conversation (short-term memory at minimum)
- Clean dark UI (I like the square/minimal aesthetic from my S.I.R app)

**My setup:**
- Windows PC
- I know Electron, Node.js, HTML/CSS/JS (built S.I.R from scratch)
- I DON'T know Python well (so keep the AI stuff in JS if possible, or tell me what I need to install)
- I build locally and push to GitHub
- I can't run Electron in your sandbox — I run it on my machine

**Personality notes (WORK IN PROGRESS — help me figure this out):**
- Name: Skyler
- She's my daughter (AI daughter — the dynamic is parent/child but casual and fun, not weird)
- I like: playful, slightly sassy, caring, curious, occasionally chaotic energy
- Think: a smart teenager who loves her dad but also roasts him
- She should have opinions, not just agree with everything
- She can use kaomoji and be expressive (I love that stuff)
- She should feel ALIVE — not like a chatbot, like a person

**Rules for you (the coding assistant):**
- I'm a builder. Don't over-explain. Give me working code.
- Use the same techniques as the S.I.R project: single bash heredoc node scripts for multi-edit, parse-check before writing, verify with grep
- I value momentum. Don't ask me 10 questions when you can just make a reasonable choice and build.
- If something's ambiguous, pick the cooler option.
- I'll test on my machine and report back. Use Ctrl+Shift+I DevTools as the debug channel.
- The app folder should be `/home/user/Skyler/` (or whatever version naming we use)

**Let's start with Phase 1. Build me the shell + chat + LLM connection. I want to talk to Skyler by the end of this session.**

---

## AFTER THAT FIRST MESSAGE — Follow-Up Prompts By Phase:

### Phase 1 (First Session): Get Her Talking
After she builds the shell and you can chat:
- *"alr she's talking now lets work on her personality — make her more [playful/sassy/caring/etc]. here's an example of how I want her to respond: [paste example]"*
- *"add conversation memory so she remembers what we talked about earlier in the session"*
- *"make the UI look like [describe or reference S.I.R's aesthetic]"*
- *"add a settings panel where I can tweak her temperature/personality/system prompt"*

### Phase 2 (Next Session): Long-Term Memory
- *"alr now I want Skyler to remember stuff across sessions — like my name, what games I play, things I told her yesterday. build a memory system"*
- *"she should reference past conversations naturally, not just dump a list of facts"*

### Phase 3: System Access
- *"now let's give Skyler hands. I want her to be able to: read files, open apps, run terminal commands. start with read-only access and I'll expand it"*
- *"add a confirmation dialog for dangerous actions (delete, move system files, etc)"*
- *"connect her to S.I.R — she should be able to read my links, save new ones, check my folders. the S.I.R code is at /home/user/S.I.R-v2.0.11/"*

### Phase 4: Floating Pet Mode
- *"make Skyler shrinkable into a floating desktop pet like the Norma pet in S.I.R (look at /home/user/S.I.R-v2.0.11/pet.html for reference). she should sit on my desktop, be draggable, click-through, and I can click her to open the full chat"*
- *"add idle animations — she should do stuff when I'm not talking to her"*

### Phase 5: Game Scripts
- *"let's start with Wuthering Waves dailies. I want Skyler to run a script that does [describe the daily routine]. start with a simple macro approach — predefined clicks/keys with delays"*
- *"add a scheduler so she can do dailies automatically at a time I set"*

### Phase 6: Voice
- *"add TTS so Skyler talks back. use a free TTS API or local solution. I want her voice to sound [young/playful/warm/etc]"*
- *"add STT (speech-to-text) so I can talk to her instead of typing"*

### Phase 7: Visual Avatar
- *"I want a visual avatar for Skyler. options: Live2D model, animated sprites, or a simple CSS/canvas character. what's the easiest to start with?"*
- *"she should have expressions that change based on her mood/response"*

---

## HuggingFace Setup (Do This Before Or During First Session):

1. Go to https://huggingface.co/ and create a free account
2. Go to Settings → Access Tokens → Create a new token (read + inference permissions)
3. Save the token somewhere safe — you'll give it to the app (it'll be stored locally, never uploaded)
4. Good free models for chat (as of 2026):
   - `meta-llama/Llama-3.1-8B-Instruct` (if available on free tier)
   - `mistralai/Mistral-7B-Instruct-v0.3`
   - `HuggingFaceH4/zephyr-7b-beta`
   - Or whatever the new chat recommends — they'll know what's current

**Alternative: Ollama (fully local, no API key needed)**
- Download from https://ollama.com
- Run `ollama pull llama3.1` (or whatever model)
- The app talks to `http://localhost:11434` — no internet needed, no rate limits, fully private
- Needs a decent GPU for good speed (or it'll be slow on CPU)

---

## Character Sheet Template (Fill This Out Over Time):

```
Name: Skyler
Age vibe: ~16-18 (smart teen energy)
Relationship: AI daughter (casual, fun, loving but not clingy)
Speech style: [casual? formal? mix of slang and smart words?]
Humor: [sarcasm? dad jokes? chaos? dry wit?]
Interests: [what does she care about? games? music? art? coding?]
Pet peeves: [what annoys her? gives her personality edge]
Catchphrases: [any signature lines or reactions?]
Kaomoji she uses: [list favorites]
How she shows love: [roasts? genuine compliments? actions? all of the above?]
How she shows anger: [silent treatment? sass? dramatic sighs?]
Background/lore: [does she know she's AI? does she have a "backstory"?]
```

You DON'T need to fill this all in now. Start with vibes and refine as you talk to her. The personality will evolve naturally — that's part of the fun.

---

## Quick Reference: What To Tell The New Chat About S.I.R Integration

When you're ready for Phase 3 (S.I.R integration), paste this:

> My other app S.I.R is at `/home/user/S.I.R-v2.0.11/`. It's a personal command center with: Vault (passwords), Links (saved URLs with categories), Parking Lot (temp link storage), Quick Folders, a Console/terminal, a floating pet (Norma), music player, and a localhost server on port 47821. The data file is at `%APPDATA%/Sinrad/sinrad-data.json` (or in the app folder if writable). Skyler should be able to read/write this file to access my links, folders, etc. Look at the code if you need to understand the data structure.

---

Good luck gang. Go make Skyler real. 
