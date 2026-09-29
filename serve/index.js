import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import { pipeline } from "@xenova/transformers";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import wavefile from "wavefile";

// Configura o executável do FFmpeg baixado via npm
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
app.use(cors());
app.use(express.json());

// Garante que a pasta de uploads temporários exista
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const upload = multer({ dest: "uploads/" });
let transcriber = null;

async function getTranscriber() {
  if (!transcriber) {
    console.log("Aguarde: carregando modelo Whisper Base (Português do Brasil)...");
    transcriber = await pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-base",
      { quantized: true }
    );
    console.log("Whisper Base pronto para uso!");
  }
  return transcriber;
}
function convertToWav16kMono(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat("wav")
      .audioFrequency(16000)
      .audioChannels(1)
      .audioCodec("pcm_s16le")
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Nenhum arquivo enviado." });
  }

  const inputFilePath = req.file.path;
  const wavOutputPath = `${inputFilePath}.wav`;

  try {
    await convertToWav16kMono(inputFilePath, wavOutputPath);

    const wavBuffer = fs.readFileSync(wavOutputPath);
    const wav = new wavefile.WaveFile(wavBuffer);
    wav.toBitDepth("32f");
    let audioData = wav.getSamples();
    if (Array.isArray(audioData)) {
      audioData = audioData[0];
    }

const model = await getTranscriber();
    const result = await model(audioData, {
      language: "portuguese",
      task: "transcribe",
      return_timestamps: "word",
      chunk_length_s: 30,
      stride_length_s: 5,
      temperature: 0.0,
      condition_on_previous_text: false,
      initial_prompt: "Transcrição em português do Brasil com pontuação e ortografia precisa.",
    });

    const rawChunks = result.chunks || [];
    const words = rawChunks
      .filter((c) => c.text && c.text.trim().length > 0)
      .map((c) => ({
        word: c.text.trim(),
        start: Math.round(c.timestamp[0] * 1000),
        end: Math.round(c.timestamp[1] * 1000),
      }));

    res.json({
      text: result.text.trim(),
      words: words,
    });
  } catch (error) {
    console.error("Erro na transcrição:", error);
    res.status(500).json({ error: "Falha ao transcrever o áudio." });
  } finally {
    if (fs.existsSync(inputFilePath)) fs.unlinkSync(inputFilePath);
    if (fs.existsSync(wavOutputPath)) fs.unlinkSync(wavOutputPath);
  }
});
const PORT = 3001;
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`A porta ${PORT} já está em uso por outro processo.`);
  } else {
    console.error("Erro no servidor:", err);
  }
});

// Garante que o processo permaneça ativo mantendo o timer no event loop
setInterval(() => {}, 1 << 30);