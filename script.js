// ==========================================
// 1. モデル候補リスト
// ==========================================
const modelFolder = 'models/';
// ⚠️ ここにご自身がアップロードした実際のファイル名を入れてください
const modelFiles = ['flower1.glb', 'flower2.glb', 'star.glb'];

// ==========================================
// 2. Three.jsの準備 (3Dモデル表示)
// ==========================================
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

const light = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(light);

// ==========================================
// 3. 起動時に3個（重複なし、足りなければ重複あり）をランダムプリロード
// ==========================================
function pickRandomModels(files, count) {
  const pool = [...files];
  const picked = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  while (picked.length < count) {
    picked.push(files[Math.floor(Math.random() * files.length)]);
  }
  return picked;
}

const PRELOAD_COUNT = 3;
const selectedFiles = pickRandomModels(modelFiles, PRELOAD_COUNT);

const loader = new THREE.GLTFLoader();
const loadedModels = []; 
let loadedReadyCount = 0;
let isReady = false;

// ローディング表示用の簡易UI
const loadingEl = document.createElement('div');
loadingEl.textContent = '読み込み中...';
loadingEl.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-family:sans-serif;font-size:24px;z-index:10;';
document.body.appendChild(loadingEl);

selectedFiles.forEach((fileName) => {
  loader.load(
    modelFolder + fileName,
    (gltf) => {
      const model = gltf.scene;
      model.scale.set(0.5, 0.5, 0.5);
      model.visible = false;
      scene.add(model);
      loadedModels.push(model);

      loadedReadyCount++;
      if (loadedReadyCount === selectedFiles.length) {
        isReady = true;
        loadingEl.style.display = 'none';
        console.log('プリロード完了:', selectedFiles);
      }
    },
    undefined,
    (error) => {
      console.error('モデル読み込み失敗:', modelFolder + fileName, error);
      loadedReadyCount++;
      if (loadedReadyCount === selectedFiles.length) {
        isReady = loadedModels.length > 0;
        loadingEl.textContent = loadedModels.length > 0 ? '' : 'モデルの読み込みに失敗しました';
        if (loadedModels.length > 0) loadingEl.style.display = 'none';
      }
    }
  );
});

// ==========================================
// 4. 手の検出状態に応じてランダム表示切替え
// ==========================================
let currentModel = null;
let wasHandPresent = false; 

function showRandomModel() {
  if (!isReady || loadedModels.length === 0) return null;
  loadedModels.forEach((m) => (m.visible = false));
  const next = loadedModels[Math.floor(Math.random() * loadedModels.length)];
  next.visible = true;
  return next;
}

// ==========================================
// 5. MediaPipe Handsの準備 (手のひら感知)
// ==========================================
const videoElement = document.getElementById('video');

const hands = new Hands({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

// 💡 カメラがインカメかどうかの判定フラグ（最初はインカメ）
let isFrontCamera = true; 

hands.onResults((results) => {
  const handPresent = isReady && results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

  if (handPresent) {
    if (!wasHandPresent) {
      currentModel = showRandomModel();
    }

    if (currentModel) {
      currentModel.visible = true;

      const landmarks = results.multiHandLandmarks[0];
      const palm = landmarks[9];

      // 💡 インカメとアウトカメでX座標の動きの向き（+か-か）を反転させる
      const directionX = isFrontCamera ? -1 : 1;
      const x = directionX * (palm.x - 0.5) * 10;
      const y = -(palm.y - 0.5) * 10;

      currentModel.position.set(x, y, 0);
      currentModel.rotation.y += 0.05;
    }
  } else if (currentModel) {
    currentModel.visible = false;
  }

  wasHandPresent = handPresent;

  renderer.render(scene, camera);
});

// ==========================================
// 6. カメラの起動とイン/アウト切替機能
// ==========================================
let cameraUtils = null;
const switchBtn = document.getElementById('switchCameraBtn');

function startCamera() {
  if (cameraUtils) {
    cameraUtils.stop(); 
  }

  const mode = isFrontCamera ? 'user' : 'environment';

  cameraUtils = new Camera(videoElement, {
    onFrame: async () => {
      await hands.send({image: videoElement});
    },
    width: 1280,
    height: 720,
    facingMode: mode
  });
  cameraUtils.start();

  // 見た目の左右反転を調整（インカメは鏡合わせ、アウトカメはそのまま）
  videoElement.style.transform = isFrontCamera ? 'scaleX(-1)' : 'scaleX(1)';
}

// ボタンを押した時の処理
if (switchBtn) {
  switchBtn.addEventListener('click', () => {
    isFrontCamera = !isFrontCamera; 
    startCamera(); 
  });
}

// 最初のカメラ起動
startCamera();
