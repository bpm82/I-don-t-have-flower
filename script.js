// ==========================================
// 1. モデルの指定と微調整設定
// ==========================================
const modelFolder = 'models/';
const verticalModelFile = 'flower.glb';  // 手を突き出した時用（花びら）
const horizontalModelFile = 'pot.glb';   // 手を水平にした時用（鉢植え）

// 💡 モデルごとのベースサイズ微調整（ここでバランスをとります）
const verticalScaleAdjust = 1.0; 
const horizontalScaleAdjust = 0.8; 

// ==========================================
// 2. Three.jsの準備
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
// 3. モデルの読み込み
// ==========================================
const loader = new THREE.GLTFLoader();
let verticalModel = null;
let horizontalModel = null;
let isReady = false;
let loadedCount = 0;

const loadingEl = document.createElement('div');
loadingEl.textContent = '読み込み中...';
loadingEl.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:24px;z-index:10;';
document.body.appendChild(loadingEl);

function onLoadComplete() {
  loadedCount++;
  if (loadedCount === 2) {
    isReady = true;
    loadingEl.style.display = 'none';
  }
}

loader.load(modelFolder + verticalModelFile, (gltf) => {
  verticalModel = gltf.scene;
  verticalModel.visible = false;
  scene.add(verticalModel);
  onLoadComplete();
});

loader.load(modelFolder + horizontalModelFile, (gltf) => {
  horizontalModel = gltf.scene;
  horizontalModel.visible = false;
  scene.add(horizontalModel);
  onLoadComplete();
});

// ==========================================
// 4. MediaPipe Handsの準備とARの計算
// ==========================================
const videoElement = document.getElementById('video');
const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

let isFrontCamera = true; 

hands.onResults((results) => {
  const handPresent = isReady && results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

  if (verticalModel) verticalModel.visible = false;
  if (horizontalModel) horizontalModel.visible = false;

  if (handPresent) {
    const landmarks = results.multiHandLandmarks[0];
    
    // 使う関節の座標を取得
    const wrist = landmarks[0];         // 手首
    const indexMCP = landmarks[5];      // 人差し指の付け根
    const middleMCP = landmarks[9];     // 中指の付け根
    const pinkyMCP = landmarks[17];     // 小指の付け根

    // 💡 [改善1] 手の向き判定（垂直か水平か）
    const dy = Math.abs(middleMCP.y - wrist.y);
    const isVertical = dy > 0.12; // 0.12を基準に切り替え
    const currentModel = isVertical ? verticalModel : horizontalModel;

    if (currentModel) {
      currentModel.visible = true;

      // 💡 [改善2] 奥行き感知とダイナミックスケール
      const widthDx = indexMCP.x - pinkyMCP.x;
      const widthDy = indexMCP.y - pinkyMCP.y;
      const handWidth = Math.sqrt(widthDx * widthDx + widthDy * widthDy);
      
      // モデルに合わせたサイズ調整係数を掛ける
      const scaleAdjust = isVertical ? verticalScaleAdjust : horizontalScaleAdjust;
      const finalScale = handWidth * 3.0 * scaleAdjust; // 3.0は全体の基準倍率
      currentModel.scale.set(finalScale, finalScale, finalScale);

      // 💡 [改善3] イン/アウトカメラのX座標反転処理
      const directionX = isFrontCamera ? -1 : 1;
      const x = directionX * (middleMCP.x - 0.5) * 10;
      const y = -(middleMCP.y - 0.5) * 10;

      // 手のひらの中央に配置
      currentModel.position.set(x, y, 0);

      // 垂直の時は回して、水平の時は固定する演出
      if (isVertical) {
        currentModel.rotation.y += 0.05; 
      } else {
        currentModel.rotation.y = 0; 
      }
    }
  }

  renderer.render(scene, camera);
});

// ==========================================
// 5. カメラ起動と切り替え機能
// ==========================================
let cameraUtils = null;
const switchBtn = document.getElementById('switchCameraBtn');

function startCamera() {
  if (cameraUtils) cameraUtils.stop(); 
  const mode = isFrontCamera ? 'user' : 'environment';
  cameraUtils = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 1280, height: 720, facingMode: mode
  });
  cameraUtils.start();
  videoElement.style.transform = isFrontCamera ? 'scaleX(-1)' : 'scaleX(1)';
}

if (switchBtn) {
  switchBtn.addEventListener('click', () => {
    isFrontCamera = !isFrontCamera; 
    startCamera(); 
  });
}

startCamera();
