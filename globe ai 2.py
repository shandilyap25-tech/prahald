# ========= AI TRANSLATION PROTOTYPE =========
# Input: audio.wav
# Output: output.wav (translated speech)

import whisper
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
from TTS.api import TTS
import gradio as gr
import os

# ---------- CONFIG ----------
# If you get a "FileNotFoundError" for FFmpeg, uncomment the line below
# and change the path to where your ffmpeg.exe is located (usually the 'bin' folder).
# os.environ["PATH"] += os.pathsep + r"C:\ffmpeg\bin"

SRC_LANG = "eng_Latn"          # English

# Language Mapping: Name -> {NLLB Code, TTS Code}
LANGUAGES = {
    "Hindi": {"nllb": "hin_Deva", "tts": "hi"},
    "Spanish": {"nllb": "spa_Latn", "tts": "es"},
    "French": {"nllb": "fra_Latn", "tts": "fr"},
    "German": {"nllb": "deu_Latn", "tts": "de"},
    "Italian": {"nllb": "ita_Latn", "tts": "it"},
    "Portuguese": {"nllb": "por_Latn", "tts": "pt"},
    "Polish": {"nllb": "pol_Latn", "tts": "pl"},
    "Turkish": {"nllb": "tur_Latn", "tts": "tr"},
    "Russian": {"nllb": "rus_Cyrl", "tts": "ru"},
    "Dutch": {"nllb": "nld_Latn", "tts": "nl"},
    "Czech": {"nllb": "ces_Latn", "tts": "cs"},
    "Arabic": {"nllb": "arb_Arab", "tts": "ar"},
    "Chinese": {"nllb": "zho_Hans", "tts": "zh-cn"},
    "Japanese": {"nllb": "jpn_Jpan", "tts": "ja"},
    "Hungarian": {"nllb": "hun_Latn", "tts": "hu"},
    "Korean": {"nllb": "kor_Hang", "tts": "ko"},
}
# -------------------------------------------

device = "cuda" if torch.cuda.is_available() else "cpu"

# 1️⃣ SPEECH → TEXT (Whisper)
print("Loading Whisper...")
whisper_model = whisper.load_model("base", device=device)

# 2️⃣ TEXT → TRANSLATION (NLLB)
print("Loading NLLB...")
tokenizer = AutoTokenizer.from_pretrained("facebook/nllb-200-distilled-600M")
model = AutoModelForSeq2SeqLM.from_pretrained("facebook/nllb-200-distilled-600M").to(device)

# 3️⃣ TRANSLATED TEXT → SPEECH (Coqui TTS)
print("Loading Coqui TTS...")
# Using XTTS v2 for multilingual support (supports Hindi) and voice cloning
tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2").to(device)

def process_audio(input_audio_path, target_language, progress=gr.Progress()):
    if input_audio_path is None:
        return "No audio provided", None, None

    progress(0, desc="Initializing...")

    # Get codes based on selection
    lang_config = LANGUAGES[target_language]
    tgt_lang_nllb = lang_config["nllb"]
    tgt_lang_tts = lang_config["tts"]

    # 1. Transcribe
    progress(0.2, desc="Transcribing Audio...")
    stt_result = whisper_model.transcribe(input_audio_path)
    text = stt_result["text"]

    # 2. Translate
    progress(0.5, desc="Translating Text...")
    tokenizer.src_lang = SRC_LANG
    inputs = tokenizer(text, return_tensors="pt").to(device)
    outputs = model.generate(
        **inputs,
        forced_bos_token_id=tokenizer.lang_code_to_id[tgt_lang_nllb]
    )
    translated_text = tokenizer.decode(outputs[0], skip_special_tokens=True)

    # Save text to file
    text_output_path = "translated_text.txt"
    with open(text_output_path, "w", encoding="utf-8") as f:
        f.write(translated_text)

    # 3. Generate Speech
    progress(0.8, desc="Generating Speech...")
    output_path = "output_gradio.wav"
    tts.tts_to_file(text=translated_text, file_path=output_path, speaker_wav=input_audio_path, language=tgt_lang_tts)
    
    progress(1.0, desc="Done!")
    return translated_text, output_path, text_output_path

# Create Web Interface
interface = gr.Interface(
    fn=process_audio,
    inputs=[
        gr.Audio(sources=["microphone", "upload"], type="filepath", label="Speak or Upload (English)"),
        gr.Dropdown(choices=list(LANGUAGES.keys()), value="Hindi", label="Target Language")
    ],
    outputs=[
        gr.Textbox(label="Translated Text"),
        gr.Audio(label="Translated Speech (Voice Cloned)"),
        gr.File(label="Download Text")
    ],
    title="AI Voice Translator",
    description="Convert English speech to multiple languages with Voice Cloning."
)

if __name__ == "__main__":
    print("Launching Web App... Look for the 'Running on public URL' link below!")
    interface.launch(share=True)
