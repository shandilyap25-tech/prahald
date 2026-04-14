# ========= AI TRANSLATION PROTOTYPE =========
# Input: audio.wav
# Output: output.wav (translated speech)

import whisper
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
from TTS.api import TTS

# ---------- CONFIG ----------
INPUT_AUDIO = "input.wav"     # your voice file
OUTPUT_AUDIO = "output.wav"   # translated voice
SRC_LANG = "eng_Latn"          # English
TGT_LANG = "hin_Deva"          # Hindi
TGT_LANG_CODE = "hi"           # Hindi (for TTS)
# -------------------------------------------

device = "cuda" if torch.cuda.is_available() else "cpu"

# 1️⃣ SPEECH → TEXT (Whisper)
print("Loading Whisper...")
whisper_model = whisper.load_model("base", device=device)

print("Transcribing audio...")
stt_result = whisper_model.transcribe(INPUT_AUDIO)
text = stt_result["text"]
print("TEXT:", text)

# 2️⃣ TEXT → TRANSLATION (NLLB)
print("Loading NLLB...")
tokenizer = AutoTokenizer.from_pretrained("facebook/nllb-200-distilled-600M")
model = AutoModelForSeq2SeqLM.from_pretrained("facebook/nllb-200-distilled-600M").to(device)

tokenizer.src_lang = SRC_LANG
inputs = tokenizer(text, return_tensors="pt").to(device)
outputs = model.generate(
    **inputs,
    forced_bos_token_id=tokenizer.lang_code_to_id[TGT_LANG]
)
translated_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
print("TRANSLATED:", translated_text)

# 3️⃣ TRANSLATED TEXT → SPEECH (Coqui TTS)
print("Generating speech...")
# Using XTTS v2 for multilingual support (supports Hindi) and voice cloning
tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2").to(device)
tts.tts_to_file(text=translated_text, file_path=OUTPUT_AUDIO, speaker_wav=INPUT_AUDIO, language=TGT_LANG_CODE)

print("DONE ✔ Output saved as", OUTPUT_AUDIO)
