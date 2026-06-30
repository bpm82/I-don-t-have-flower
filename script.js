// ==========================================
// 1. モデルの指定と微調整設定
// ==========================================
const modelFolder = 'models/';
const verticalModelFile = 'flower.glb';  // 手を突き出した時用（花びら）
const horizontalModelFile = 'pot.glb';   // 手を水平にした時用（鉢植え）

// 💡 モデルのベースサイズ微調整
const verticalScaleAdjust = 2.0; 
const horizontalScaleAdjust = 2.5; // 【変更】大きさを半分（5.0から2.5）にしました

// 💡 ポット（鉢植え）の高さ調整
const potOffsetY = 1.0; // 【変更】位置を少し上げるために「1.0」にしました（もっと上げたい場合は数値を大きくしてください）

// 💡 モデルの初期角度（ラジアン単位）
const flowerRotationY = Math.PI; 
const potRotationY = Math.PI / 2; // 【追加】90度（真横）に回転させる設定を追加しました

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
    
    const wrist = landmarks[0];
    const indexMCP = landmarks[5];
    const middleMCP = landmarks[9];
    const pinkyMCP = landmarks[17];

    // 手のひらの向き（法線ベクトル）を計算
    const ax = indexMCP.x - wrist.x;
    const ay = indexMCP.y - wrist.y;
    const az = indexMCP.z - wrist.z;
    
    const bx = pinkyMCP.x - wrist.x;
    const by = pinkyMCP.y - wrist.y;
    const bz = pinkyMCP.z - wrist.z;
    
    // 外積で法線を求める
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    const normal = { x: nx / len, y: ny / len, z: nz / len };

    const zWeight = Math.abs(normal.z); 
    const yWeight = Math.abs(normal.y); 

    const isVertical = zWeight > (yWeight * 1.0); 
    const currentModel = isVertical ? verticalModel : horizontalModel;

    if (currentModel) {
      currentModel.visible = true;

      // 奥行き感知とダイナミックスケール
      const widthDx = indexMCP.x - pinkyMCP.x;
      const widthDy = indexMCP.y - pinkyMCP.y;
      const handWidth = Math.sqrt(widthDx * widthDx + widthDy * widthDy);
      
      const scaleAdjust = isVertical ? verticalScaleAdjust : horizontalScaleAdjust;
      const finalScale = handWidth * 3.0 * scaleAdjust; 
      currentModel.scale.set(finalScale, finalScale, finalScale);

      // X, Y座標の計算
      const directionX = isFrontCamera ? -1 : 1;
      const x = directionX * (middleMCP.x - 0.5) * 10;
      let y = -(middleMCP.y - 0.5) * 10;

      // 鉢植え（水平）の時だけ、Y座標（高さ）を上にずらす
      if (!isVertical) {
        y += potOffsetY; 
      }

      currentModel.position.set(x, y, 0);

      // 角度を固定する
      if (isVertical) {
        // 花びら：Y軸を中心に180度回転して固定
        currentModel.rotation.set(0, flowerRotationY, 0);
      } else {
        // 鉢植え：【変更】Y軸を中心に90度回転して固定
        currentModel.rotation.set(0, potRotationY, 0); 
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
