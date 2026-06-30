// ==========================================
// 1. ランダムなモデルの選択
// ==========================================
const modelFolder = 'models/';
// 用意したモデルのファイル名をリスト化する
const modelFiles = ['flower1.glb', 'flower2.glb', 'star.glb'];

// リストの中からランダムに1つ選ぶ
const randomModelName = modelFiles[Math.floor(Math.random() * modelFiles.length)];
const modelPath = modelFolder + randomModelName;

console.log('今回表示するモデル:', modelPath);

// ==========================================
// 2. Three.jsの準備 (3Dモデル表示)
// ==========================================
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// 光源の追加
const light = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(light);

// GLTFモデルの読み込み
let loadedModel;
const loader = new THREE.GLTFLoader();
loader.load(modelPath, function (gltf) {
  loadedModel = gltf.scene;
  // 初期設定（最初は画面外か見えない場所に配置）
  loadedModel.scale.set(0.5, 0.5, 0.5); 
  loadedModel.visible = false; 
  scene.add(loadedModel);
});

// ==========================================
// 3. MediaPipe Handsの準備 (手のひら感知)
// ==========================================
const videoElement = document.getElementById('video');

const hands = new Hands({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

hands.setOptions({
  maxNumHands: 1, // 認識する手の最大数
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

hands.onResults((results) => {
  // 手が認識されているかチェック
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0 && loadedModel) {
    loadedModel.visible = true; // モデルを表示

    // 1つ目の手のデータ
    const landmarks = results.multiHandLandmarks[0];
    
    // 手のひらの中央付近（中指の付け根: インデックス9）の座標を取得
    const palm = landmarks[9]; 

    // MediaPipeの座標(0〜1)をThree.jsの空間座標に変換
    // ※カメラ反転を考慮してX座標を反転
    const x = (-(palm.x - 0.5)) * 10; 
    const y = -(palm.y - 0.5) * 10;
    
    // モデルの位置を更新
    loadedModel.position.set(x, y, 0);

    // （オプション）モデルを回転させて楽しげにする
    loadedModel.rotation.y += 0.05;
  } else if (loadedModel) {
    // 手が映っていない時はモデルを隠す
    loadedModel.visible = false;
  }
  
  // 画面の更新
  renderer.render(scene, camera);
});

// カメラの起動
const cameraUtils = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({image: videoElement});
  },
  width: 1280,
  height: 720
});
cameraUtils.start();