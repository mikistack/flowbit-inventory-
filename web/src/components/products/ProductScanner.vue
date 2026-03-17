<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { BrowserMultiFormatReader } from '@zxing/browser';

const emit = defineEmits(['detected']);

const state = reactive({
  code: '',
  scanning: false,
  error: '',
  cameras: [],
  activeCameraId: '',
});

const cameraSupport = reactive({
  ok: true,
  message: '',
});

const videoRef = ref(null);
const canvasRef = ref(null);
const inputRef = ref(null);
const isMobile = ref(false);
let reader;
let controls;
let animationId;
let scanTimeoutId;
let activeStream;

const log = (...args) => {
  console.log('[Scanner]', ...args);
};

const triggerDetect = () => {
  if (!state.code) {
    state.error = 'Scan or enter a code.';
    return;
  }
  state.error = '';
  emit('detected', state.code.trim());
  state.code = '';
  if (scanTimeoutId) {
    clearTimeout(scanTimeoutId);
    scanTimeoutId = null;
  }
};

const stopScanner = () => {
  log('Stopping scanner');
  if (controls) {
    try {
      controls.stop();
    } catch (error) {
      console.warn('[Scanner] controls.stop failed', error);
    }
    controls = null;
  }
  if (reader) {
    reader = null;
  }
  if (activeStream) {
    activeStream.getTracks().forEach((track) => track.stop());
    activeStream = null;
  }
  state.scanning = false;
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (scanTimeoutId) {
    clearTimeout(scanTimeoutId);
    scanTimeoutId = null;
  }
  if (canvasRef.value) {
    const ctx = canvasRef.value.getContext('2d');
    ctx?.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
  }
  if (videoRef.value) {
    videoRef.value.pause();
    videoRef.value.srcObject = null;
  }
};

const ensureCameraList = async () => {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoDevices = devices.filter((device) => device.kind === 'videoinput');
  state.cameras = videoDevices.map((device, idx) => ({
    id: device.deviceId,
    label: device.label || `Camera ${idx + 1}`,
  }));
  if (!state.activeCameraId && videoDevices.length) {
    state.activeCameraId =
      videoDevices.find((device) => /back|rear|environment/i.test(device.label))?.deviceId ||
      videoDevices[0].deviceId;
  }
  log('Cameras detected', state.cameras);
};

const handleReaderCallback = (result, err) => {
  if (result?.getText) {
    state.code = result.getText();
    triggerDetect();
    stopScanner();
  } else if (err && err.name !== 'NotFoundException') {
    state.error = err.message;
    console.error('[Scanner] decode error', err);
  }
};

const requestStream = async (deviceId) => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera access is not supported on this device.');
  }
  const base = { audio: false };
  const attempts = deviceId
    ? [
        { ...base, video: { deviceId: { exact: deviceId } } },
        { ...base, video: { facingMode: { ideal: 'environment' } } },
        { ...base, video: true },
      ]
    : [
        { ...base, video: { facingMode: { ideal: 'environment' } } },
        { ...base, video: { facingMode: { ideal: 'user' } } },
        { ...base, video: true },
      ];
  let lastError;
  for (const constraints of attempts) {
    try {
      log('Requesting stream with constraints', constraints);
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
      console.warn('[Scanner] constraint failed', err);
    }
  }
  throw lastError || new Error('Unable to start camera stream.');
};

const startReader = async () => {
  if (!videoRef.value) {
    throw new Error('Camera preview unavailable.');
  }
  reader = new BrowserMultiFormatReader();
  return reader.decodeFromVideoElement(videoRef.value, handleReaderCallback);
};

const startCanvasPreview = () => {
  if (!isMobile.value || !canvasRef.value) return;
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  const canvas = canvasRef.value;
  const video = videoRef.value;
  const draw = () => {
    if (!state.scanning || !canvas || !video) return;
    const ctx = canvas.getContext('2d');
    const { videoWidth, videoHeight } = video;
    if (videoWidth && videoHeight) {
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    animationId = requestAnimationFrame(draw);
  };
  animationId = requestAnimationFrame(draw);
};

const startCamera = async () => {
  log('startCamera invoked', { cameraId: state.activeCameraId });
  state.error = '';
  if (!cameraSupport.ok) {
    state.error = cameraSupport.message;
    log('Camera support blocked', cameraSupport.message);
    return;
  }
  try {
    state.scanning = true;
    await nextTick();
    const videoEl = videoRef.value;
    if (!videoEl) {
      throw new Error('Camera preview unavailable.');
    }
    activeStream = await requestStream(state.activeCameraId || undefined);
    log('Stream started', activeStream?.id);
    videoEl.srcObject = activeStream;
    await videoEl.play().catch((err) => {
      console.warn('[Scanner] video.play warning', err);
      return undefined;
    });
    controls = await startReader();
    log('Reader started');
    await ensureCameraList();
    startCanvasPreview();
    if (scanTimeoutId) {
      clearTimeout(scanTimeoutId);
    }
    scanTimeoutId = setTimeout(() => {
      state.error = 'No barcode detected. Please steady the camera and try again.';
      console.warn('[Scanner] timeout without detection');
      stopScanner();
    }, 30000);
  } catch (error) {
    console.error('[Scanner] startCamera failed', error);
    if (error.name === 'NotAllowedError') {
      state.error = 'Camera permission denied. Please allow access to use scanning.';
    } else if (error.name === 'NotReadableError' || /video source/i.test(error.message || '')) {
      state.error = 'Camera is busy or unavailable. Close other apps using the camera and try again.';
    } else {
      state.error = error.message || 'Unable to access camera. Please check permissions.';
    }
    stopScanner();
  }
};

const toggleScanner = async () => {
  if (state.scanning) {
    stopScanner();
    return;
  }
  await startCamera();
};

onBeforeUnmount(() => {
  stopScanner();
});

const detectMobile = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  const coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  return /android|iphone|ipad|ipod/i.test(ua) || coarsePointer;
};

const evaluateCameraSupport = () => {
  if (typeof navigator === 'undefined') return;
  const mediaAvailable = !!navigator.mediaDevices?.getUserMedia;
  if (!mediaAvailable) {
    cameraSupport.ok = false;
    cameraSupport.message = 'Camera API is not available in this browser. Try Chrome or Edge to scan with your phone.';
    return;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const secure = window.isSecureContext || host === 'localhost' || host === '127.0.0.1';
    if (!secure) {
      cameraSupport.ok = false;
      cameraSupport.message = 'Mobile scanning requires a secure (HTTPS) link. Please open the Cloudflare URL to allow camera access.';
      return;
    }
  }
  cameraSupport.ok = true;
  cameraSupport.message = '';
};

onMounted(() => {
  isMobile.value = detectMobile();
  inputRef.value?.focus();
  evaluateCameraSupport();
  ensureCameraList();
});

watch(
  () => state.activeCameraId,
  async (newId, oldId) => {
    if (!state.scanning || !newId || newId === oldId) return;
    stopScanner();
    await startCamera();
  }
);

const cameraUnavailable = computed(() => isMobile.value && !cameraSupport.ok);
</script>

<template>
  <div class="scanner-panel">
    <div class="flex flex-col gap-3 sm:flex-row">
      <label class="flex-1 text-sm text-slate-600">
        Barcode / SKU
        <input
          v-model="state.code"
          ref="inputRef"
          type="text"
          class="input"
          placeholder="Scan with barcode gun or type code"
          @keydown.enter.prevent="triggerDetect"
        />
      </label>
      <div class="flex flex-col sm:w-40 gap-2">
        <template v-if="isMobile">
          <button
            type="button"
            class="btn-secondary"
            :disabled="cameraUnavailable"
            @click="toggleScanner"
          >
            {{ state.scanning ? 'Stop Camera' : 'Use Camera' }}
          </button>
          <button type="button" class="btn-primary" @click="triggerDetect">Add Item</button>
        </template>
        <template v-else>
          <button type="button" class="btn-secondary" @click="inputRef.value?.focus()">
            Focus Scanner
          </button>
          <button type="button" class="btn-primary" @click="triggerDetect">Add Item</button>
        </template>
      </div>
    </div>
    <p class="text-xs text-slate-500">
      <template v-if="isMobile">
        Mobile devices use the rear camera by default when scanning. Keep the barcode centered for best results.
      </template>
      <template v-else>
        Desktop users: connect your USB barcode scanner and scan directly into the field above. No camera required.
      </template>
    </p>
    <p v-if="cameraUnavailable" class="text-xs text-amber-600">{{ cameraSupport.message }}</p>
    <p v-if="state.error" class="text-xs text-rose-600">{{ state.error }}</p>
    <div v-if="state.scanning" class="scanner-video space-y-2">
      <video
        ref="videoRef"
        :class="['w-full rounded-lg', isMobile ? 'hidden' : '']"
        autoplay
        muted
        playsinline
      ></video>
      <canvas
        v-if="isMobile"
        ref="canvasRef"
        data-preview="true"
        class="w-full rounded-lg border border-dashed border-slate-300"
      ></canvas>
      <div v-if="state.cameras.length > 1" class="flex items-center gap-2 text-xs text-slate-500">
        <label class="font-semibold">Camera</label>
        <select v-model="state.activeCameraId" class="rounded-xl border border-slate-200 px-2 py-1 flex-1">
          <option v-for="cam in state.cameras" :key="cam.id" :value="cam.id">{{ cam.label }}</option>
        </select>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scanner-panel {
  @apply space-y-2 border border-slate-200 rounded-2xl p-4 bg-white shadow-sm;
}
.input {
  @apply mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-brand-300;
}
.btn-primary {
  @apply w-full rounded-2xl bg-brand-600 text-white py-2 text-sm font-semibold disabled:opacity-50;
}
.btn-secondary {
  @apply w-full rounded-2xl border border-slate-200 py-2 text-sm font-semibold hover:bg-slate-50;
}
.scanner-video {
  @apply mt-2 rounded-2xl overflow-hidden border border-slate-200;
}
</style>
