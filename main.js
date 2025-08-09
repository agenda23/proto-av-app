// VJ風Webアプリケーション メインファイル
import * as THREE from 'three';

// アプリケーション状態
const AppState = {
    currentScene: 1,
    maxScenes: 12,
    isPlaying: false,
    bpm: 128,
    volume: 0.7,
    autoMode: false, // 自動シーン切り替え
    showHelp: false, // ヘルプ表示フラグ
    effects: {
        reverb: 0,
        filter: 0.5,
        distortion: 0,
        intensity: 1.0, // 視覚効果の強度
        colorShift: 0, // 色相シフト
        flashTrigger: false, // フラッシュトリガー
        globalHue: 0, // グローバル色相
        globalSaturation: 1.0, // グローバル彩度
        globalBrightness: 1.0, // グローバル明度
        randomColorMode: false, // ランダムカラーモード
        wireframe: false // ワイヤーフレーム表示
    },
    audioData: {
        bass: 0,
        mid: 0,
        treble: 0,
        waveform: [],
        volume: 0,
        peak: 0, // ピーク検出
        beatDetected: false // ビート検出
    },
    visualEffects: {
        explosions: [],
        flashes: [],
        trails: [],
        screenEffects: [], // 画面全体エフェクト
        ripples: [], // リップルエフェクト
        colorShifts: [] // 色変更エフェクト
    },
    camera: {
        target: { x: 0, y: 0, z: 0 },
        spherical: {
            radius: 5,
            theta: 0,
            phi: Math.PI / 2
        },
        shake: { x: 0, y: 0, z: 0 }, // カメラシェイク
        isDragging: false,
        lastMouse: { x: 0, y: 0 }
    },
    time: 0,
    currentTime: {
        hours: 0,
        minutes: 0,
        seconds: 0,
        milliseconds: 0,
        totalSeconds: 0,
        timeOfDay: 0 // 0-1の値で一日の時間を表現
    }
};

// Three.js 関連変数
let threeScene, threeCamera, threeRenderer;
let currentVisualScene;
let particleSystem;
let shaderMaterial;
let tunnel;

// p5.js インスタンス
let p5Instance;

// オーディオ関連
let audioEngine = {
    kick: null,
    hihat: null,
    bass: null,
    synth: null,
    fft: null,
    reverb: null,
    filter: null,
    sequencer: null,
    stepCount: 0,
    lastStepTime: 0,
    patterns: {
        kick: [
            [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], // 基本4つ打ち
            [1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0], // オフビート
            [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0]  // シンコペーション
        ],
        hihat: [
            [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], // ベーシック
            [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1], // ハイハットロール
            [1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0]  // アグレッシブ
        ],
        bass: [
            [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], // ミニマル
            [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], // リズミック
            [1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0]  // ファンキー
        ]
    },
    currentPatterns: { kick: 0, hihat: 0, bass: 0 },
    scales: {
        minor: [55, 58, 62, 65, 69, 73, 77, 82], // A minor scale
        chromatic: [55, 58, 62, 65, 69, 73, 77, 82, 87, 92, 98, 104]
    }
};

// メイン初期化関数
function init() {
    console.log('VJ風Webアプリケーション 初期化開始...');
    
    // Three.js初期化
    initThreeJS();
    
    // p5.js初期化（Instance Mode）
    initP5JS();
    
    // イベントリスナー設定
    setupEventListeners();
    
    // アニメーションループ開始
    animate();
    
    console.log('初期化完了');
}

// Three.js初期化
function initThreeJS() {
    const canvas = document.getElementById('three-canvas');
    
    // シーン作成
    threeScene = new THREE.Scene();
    
    // カメラ作成
    threeCamera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    threeCamera.position.z = 5;
    
    // レンダラー作成
    threeRenderer = new THREE.WebGLRenderer({ canvas: canvas });
    threeRenderer.setSize(window.innerWidth, window.innerHeight);
    
    // 初期シーンを設定
    setupScene1();
    
    console.log('Three.js初期化完了');
}

// p5.js初期化（Instance Mode）
function initP5JS() {
    const sketch = (p) => {
        let fft;
        let audioStarted = false;
        
        p.setup = function() {
            const canvas = p.createCanvas(window.innerWidth, window.innerHeight);
            canvas.parent('p5-container');
            
            console.log('p5.js初期化完了');
        };
        
        // オーディオの初期化を遅延実行（軽量化版・ブラウザ互換性向上）
        function initAudio() {
            if (!audioStarted) {
                try {
                    // ユーザーインタラクションが必要かチェック
                    const audioCtx = p.getAudioContext();
                    if (audioCtx) {
                        // ブラウザ互換性チェック
                        if (audioCtx.state === 'suspended') {
                            // ユーザーインタラクション後にresumeを試行
                            audioCtx.resume().then(() => {
                                if (audioCtx.state === 'running') {
                                    initializeAudioComponents(p);
                                }
                            }).catch(e => {
                                console.warn('AudioContext resume失敗:', e);
                            });
                        } else if (audioCtx.state === 'running') {
                            initializeAudioComponents(p);
                        }
                    }
                } catch (e) {
                    console.warn('オーディオ初期化エラー:', e);
                    audioStarted = false;
                }
            }
        }
        
        // オーディオコンポーネントの初期化
        function initializeAudioComponents(p) {
            try {
                        // 軽量FFT分析器を初期化（サイズを大幅縮小）
                        fft = new p5.FFT(0.6, 64); // デフォルト(0.8, 1024)から(0.6, 64)に軽量化
                        audioEngine.fft = fft;
                        
                        // 最小限のオーディオ要素を作成
                        createAudioElements(p);
                        
                        audioStarted = true;
                        console.log('オーディオエンジン初期化完了（軽量版）');
                } catch (e) {
                console.warn('オーディオコンポーネント初期化エラー:', e);
            }
        }
        
        // AudioContextヘルパー関数
        function getAudioContextHelper() {
            try {
                return p.getAudioContext();
            } catch (e) {
                return null;
            }
        }
        
        p.draw = function() {
            p.clear();
            
            // オーディオ分析
            analyzeAudio();
            
            // 画面エフェクト更新
            updateScreenEffects(p);
            
            // 2D UI描画
            drawUI(p);
            
            // ヘルプ表示
            if (AppState.showHelp) {
                drawHelpSystem(p);
            }
            
            // デバッグ情報表示
            drawDebugInfo(p);
        };
        
        p.mousePressed = function() {
            // 初回クリック時にオーディオを初期化
            initAudio();
            
            // UI領域のクリック判定
            if (handleUIClick(p, p.mouseX, p.mouseY)) {
                return; // UI操作の場合はエフェクトを表示しない
            }
            
            // マウスクリック時のエフェクト
            createClickEffect(p, p.mouseX, p.mouseY);
        };
        
        p.mouseDragged = function() {
            // UI領域でのドラッグは無視
            if (p.mouseX >= 20 && p.mouseX <= 220 && p.mouseY >= 20 && p.mouseY <= 170) {
                return;
            }
            
            // カメラ操作（シーン1と2で有効）
            if (AppState.currentScene === 1 || AppState.currentScene === 2) {
                const deltaX = (p.mouseX - p.pmouseX) * 0.01;
                const deltaY = (p.mouseY - p.pmouseY) * 0.01;
                
                AppState.camera.spherical.theta -= deltaX;
                AppState.camera.spherical.phi += deltaY;
                
                // 垂直角度制限（真上・真下を防ぐ）
                AppState.camera.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, AppState.camera.spherical.phi));
                
                updateCameraPosition();
            }
        };
        
        p.mouseWheel = function(event) {
            // ズーム操作
            if (AppState.currentScene === 1 || AppState.currentScene === 2) {
                AppState.camera.spherical.radius += event.delta * 0.01;
                AppState.camera.spherical.radius = Math.max(2, Math.min(20, AppState.camera.spherical.radius));
                updateCameraPosition();
            }
            return false;
        };
        
        p.keyPressed = function() {
            // キー入力時にもオーディオを初期化
            initAudio();
        };
    };
    
    p5Instance = new p5(sketch);
}

// オーディオ要素作成（メモリリーク防止版）
function createAudioElements(p) {
    try {
        // 既存のオーディオオブジェクトがあれば削除
        disposeAudioElements();
        
        console.log('オーディオ要素作成開始...');
        
        // 最小限のオーディオ要素のみ作成
        audioEngine.kick = new p5.Oscillator('sine');
        audioEngine.kick.freq(60);
        audioEngine.kick.amp(0);
        audioEngine.kick.start();
        
        // 他の音源は使用時に動的作成することでメモリ節約
        audioEngine.isInitialized = true;
        
        console.log('オーディオ要素作成完了（軽量版）');
    } catch (e) {
        console.warn('オーディオ要素作成エラー:', e);
        audioEngine.isInitialized = false;
    }
}

// Three.jsシーンの完全な削除（改善版）
function disposeThreeJSScene() {
    if (!threeScene) return;
    
    // 全ての子オブジェクトを再帰的に削除
    function disposeObject(object) {
        if (object.children && object.children.length > 0) {
            // 子オブジェクトを再帰的に削除
            for (let i = object.children.length - 1; i >= 0; i--) {
                disposeObject(object.children[i]);
            }
        }
        
        // ジオメトリの削除
        if (object.geometry) {
            object.geometry.dispose();
        }
        
        // マテリアルの削除
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(material => disposeMaterial(material));
            } else {
                disposeMaterial(object.material);
            }
        }
        
        // 親から削除
        if (object.parent) {
            object.parent.remove(object);
        }
    }
    
    // マテリアルの完全な削除
    function disposeMaterial(material) {
        if (!material) return;
        
        // テクスチャの削除
        Object.keys(material).forEach(key => {
            const value = material[key];
            if (value && typeof value.dispose === 'function') {
                value.dispose();
            }
        });
        
        // シェーダーマテリアルのuniforms削除
        if (material.uniforms) {
            Object.keys(material.uniforms).forEach(key => {
                const uniform = material.uniforms[key];
                if (uniform.value && typeof uniform.value.dispose === 'function') {
                    uniform.value.dispose();
                }
            });
        }
        
        material.dispose();
    }
    
    // 全ての子オブジェクトを削除
    while (threeScene.children.length > 0) {
        disposeObject(threeScene.children[0]);
    }
    
    // グローバル変数のリセット
    currentVisualScene = null;
    particleSystem = null;
    if (shaderMaterial) {
        disposeMaterial(shaderMaterial);
        shaderMaterial = null;
    }
    tunnel = null;
}

// オーディオ要素の適切な削除
function disposeAudioElements() {
    try {
        if (audioEngine.kick && typeof audioEngine.kick.stop === 'function') {
            audioEngine.kick.stop();
            audioEngine.kick.dispose();
        }
        if (audioEngine.hihat && typeof audioEngine.hihat.stop === 'function') {
            audioEngine.hihat.stop();
            audioEngine.hihat.dispose();
        }
        if (audioEngine.bass && typeof audioEngine.bass.stop === 'function') {
            audioEngine.bass.stop();
            audioEngine.bass.dispose();
        }
        if (audioEngine.synth && typeof audioEngine.synth.stop === 'function') {
            audioEngine.synth.stop();
            audioEngine.synth.dispose();
        }
        
        // オブジェクトをリセット
        audioEngine.kick = null;
        audioEngine.hihat = null;
        audioEngine.bass = null;
        audioEngine.synth = null;
        audioEngine.reverb = null;
        audioEngine.filter = null;
        audioEngine.distortion = null;
        
    } catch (e) {
        console.warn('オーディオ要素削除エラー:', e);
    }
}

// オーディオ分析（軽量化版）
let audioAnalysisCounter = 0;
function analyzeAudio() {
    // 分析頻度を制限（メモリ・CPU負荷軽減）
    audioAnalysisCounter++;
    if (audioAnalysisCounter % 3 !== 0) {
        return; // 3フレームに1回のみ分析
    }
    
    try {
        if (audioEngine.fft) {
            const spectrum = audioEngine.fft.analyze(64); // 1024から64に削減
            
            if (spectrum && spectrum.length > 0) {
                // 周波数帯域別のエネルギー計算（簡略化）
                AppState.audioData.bass = calculateBandEnergy(spectrum, 0, 4);
                AppState.audioData.mid = calculateBandEnergy(spectrum, 4, 20);
                AppState.audioData.treble = calculateBandEnergy(spectrum, 20, 63);
                
                // 全体音量計算
                AppState.audioData.volume = (AppState.audioData.bass + AppState.audioData.mid + AppState.audioData.treble) / 3;
            }
            
            // 波形データは取得しない（メモリ節約）
            // AppState.audioData.waveform = audioEngine.fft.waveform();
        }
    } catch (e) {
        // デバッグモードでのみエラーログ出力
        if (typeof window !== 'undefined' && window.location.search.includes('debug=true')) {
            console.warn('オーディオ分析エラー:', e);
        }
        // エラー時は前回の値を維持
    }
}

// AudioContextヘルパー関数（グローバル）
function getAudioContext() {
    try {
        if (typeof p5Instance !== 'undefined' && p5Instance && p5Instance.getAudioContext) {
            return p5Instance.getAudioContext();
        }
        return null;
    } catch (e) {
        return null;
    }
}

// オーディオエフェクト適用（無効化）
function applyAudioEffects() {
    // メモリリーク防止のため、エフェクトは無効化
    // エフェクト値はUIでのみ表示
}

// 帯域エネルギー計算
function calculateBandEnergy(spectrum, startBin, endBin) {
    let sum = 0;
    for (let i = startBin; i <= endBin && i < spectrum.length; i++) {
        sum += spectrum[i];
    }
    return sum / (endBin - startBin + 1) / 255;
}

// Three.js シーン1設定
function setupScene1() {
    // 既存オブジェクトを清理（改善版）
    disposeThreeJSScene();
    
    // 背景色設定
    threeScene.background = new THREE.Color(0x000000);
    
    // ライト追加
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    threeScene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(1, 1, 1);
    threeScene.add(directionalLight);
    
    // Icosahedron作成
    const geometry = new THREE.IcosahedronGeometry(1, 0);
    const material = new THREE.MeshLambertMaterial({
        color: 0x00ffff,
        emissive: 0x000000
    });
    
    currentVisualScene = new THREE.Mesh(geometry, material);
    threeScene.add(currentVisualScene);
    
    console.log('シーン1設定完了');
}

// Three.js シーン2設定（Particle Storm）
function setupScene2() {
    // 既存オブジェクトを清理（改善版）
    disposeThreeJSScene();
    
    // 背景色設定
    threeScene.background = new THREE.Color(0x000011);
    
    // パーティクル作成（数を減らして最適化）
    const particleCount = 1000; // 5000から1000に減らす
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
        // 位置
        positions[i * 3] = (Math.random() - 0.5) * 20;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
        
        // 色
        colors[i * 3] = Math.random();
        colors[i * 3 + 1] = Math.random();
        colors[i * 3 + 2] = Math.random();
        
        // 速度
        velocities[i * 3] = (Math.random() - 0.5) * 0.02;
        velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    
    const material = new THREE.PointsMaterial({
        size: 2,
        vertexColors: true,
        transparent: true,
        opacity: 0.8
    });
    
    particleSystem = new THREE.Points(geometry, material);
    threeScene.add(particleSystem);
    currentVisualScene = particleSystem;
    
    console.log('シーン2設定完了');
}

// Three.js シーン3設定（Neon Pulse Rings - 新しいかっこいいシーン）
function setupScene3() {
    // 既存オブジェクトを清理（改善版）
    disposeThreeJSScene();
    
    // 背景色設定（深いサイバーブルー）
    threeScene.background = new THREE.Color(0x000a1a);
    
    // メインのリングコンテナ
    const ringContainer = new THREE.Group();
    
    // 複数のネオンリング（同心円状に配置）
    for (let i = 0; i < 8; i++) {
        const radius = 2 + i * 0.8;
        const geometry = new THREE.RingGeometry(radius - 0.1, radius + 0.1, 32);
        
        // ネオンのような発光マテリアル
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(i / 8, 1, 0.5),
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        
        const ring = new THREE.Mesh(geometry, material);
        ring.userData = { 
            originalRadius: radius,
            phase: i * 0.5,
            speed: 0.02 + i * 0.01
        };
        
        ringContainer.add(ring);
    }
    
    // 中央のコアオーブ
    const coreGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const coreMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.9
    });
    const coreOrb = new THREE.Mesh(coreGeometry, coreMaterial);
    coreOrb.userData = { type: 'core' };
    ringContainer.add(coreOrb);
    
    // 外側のエネルギーパーティクル
    const particleCount = 200;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
        // 球面上にランダム配置
        const radius = 8 + Math.random() * 4;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        
        particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        particlePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        particlePositions[i * 3 + 2] = radius * Math.cos(phi);
        
        // ランダムな色（シアン系）
        const hue = 0.5 + Math.random() * 0.2; // シアン〜青の範囲
        particleColors[i * 3] = hue;
        particleColors[i * 3 + 1] = 1;
        particleColors[i * 3 + 2] = 0.8;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
        size: 4,
        vertexColors: true,
        transparent: true,
        opacity: 0.7
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.userData = { type: 'particles' };
    ringContainer.add(particles);
    
    threeScene.add(ringContainer);
    currentVisualScene = ringContainer;
    
    console.log('シーン3設定完了 (Neon Pulse Rings)');
}

// シーン4: ネオン・ストロボ
function setupScene4() {
    disposeThreeJSScene();
    
    threeScene.background = new THREE.Color(0x000000);
    
    // ネオンライクなオブジェクト群
    const group = new THREE.Group();
    
    for (let i = 0; i < 20; i++) {
        const geometry = new THREE.SphereGeometry(0.1 + Math.random() * 0.5, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(Math.random(), 1, 0.5),
            transparent: true,
            opacity: 0.8
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
        );
        
        group.add(mesh);
    }
    
    threeScene.add(group);
    currentVisualScene = group;
    console.log('シーン4設定完了');
}

// シーン5: パルス・グリッド
function setupScene5() {
    while(threeScene.children.length > 0) {
        const child = threeScene.children[0];
        threeScene.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    }
    
    threeScene.background = new THREE.Color(0x001a33);
    
    // グリッドパターン
    const group = new THREE.Group();
    const gridSize = 15;
    
    for (let x = -gridSize; x <= gridSize; x += 2) {
        for (let z = -gridSize; z <= gridSize; z += 2) {
            const geometry = new THREE.BoxGeometry(0.5, 0.1, 0.5);
            const material = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(0.6, 1, 0.3),
                transparent: true
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(x, 0, z);
            group.add(mesh);
        }
    }
    
    threeScene.add(group);
    currentVisualScene = group;
    console.log('シーン5設定完了');
}

// シーン6: エナジー・オーブ
function setupScene6() {
    while(threeScene.children.length > 0) {
        const child = threeScene.children[0];
        threeScene.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    }
    
    threeScene.background = new THREE.Color(0x0a0a2a);
    
    // 複数のエナジーオーブ
    const group = new THREE.Group();
    
    for (let i = 0; i < 8; i++) {
        const geometry = new THREE.SphereGeometry(1 + Math.random() * 0.5, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(i / 8, 0.8, 0.6),
            transparent: true,
            opacity: 0.7
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        const radius = 3 + Math.random() * 2;
        const angle = (i / 8) * Math.PI * 2;
        
        mesh.position.set(
            Math.cos(angle) * radius,
            (Math.random() - 0.5) * 4,
            Math.sin(angle) * radius
        );
        
        group.add(mesh);
    }
    
    threeScene.add(group);
    currentVisualScene = group;
    console.log('シーン6設定完了');
}

// シーン7: レーザー・ビーム
// シーン7設定（修正版 Laser Beams）
function setupScene7() {
    while(threeScene.children.length > 0) {
        const child = threeScene.children[0];
        threeScene.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    }
    
    threeScene.background = new THREE.Color(0x000011);
    
    // レーザービーム効果（改善版）
    const group = new THREE.Group();
    
    // 中央のコア
    const coreGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const coreMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    group.add(core);
    
    // レーザービーム
    for (let i = 0; i < 16; i++) {
        const geometry = new THREE.CylinderGeometry(0.05, 0.05, 25, 8);
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(i / 16, 1, 0.8),
            transparent: true,
            opacity: 0.7
        });
        
        const beam = new THREE.Mesh(geometry, material);
        beam.rotation.x = Math.PI / 2;
        beam.rotation.z = (i / 16) * Math.PI * 2;
        beam.position.x = Math.cos(beam.rotation.z) * 0.1;
        beam.position.y = Math.sin(beam.rotation.z) * 0.1;
        group.add(beam);
    }
    
    threeScene.add(group);
    currentVisualScene = group;
    console.log('シーン7設定完了（修正版）');
}

// シーン8: プラズマ・フィールド  
function setupScene8() {
    while(threeScene.children.length > 0) {
        const child = threeScene.children[0];
        threeScene.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    }
    
    threeScene.background = new THREE.Color(0x001122);
    
    // プラズマ効果
    const geometry = new THREE.SphereGeometry(3, 32, 32);
    const material = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.3,
        wireframe: true
    });
    
    currentVisualScene = new THREE.Mesh(geometry, material);
    threeScene.add(currentVisualScene);
    console.log('シーン8設定完了');
}

// シーン9: ストロボ・カオス
function setupScene9() {
    while(threeScene.children.length > 0) {
        const child = threeScene.children[0];
        threeScene.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    }
    
    threeScene.background = new THREE.Color(0x000000);
    
    const group = new THREE.Group();
    
    // ランダムなストロボオブジェクト
    for (let i = 0; i < 50; i++) {
        const geometry = new THREE.BoxGeometry(
            Math.random() * 0.5,
            Math.random() * 0.5,
            Math.random() * 0.5
        );
        const material = new THREE.MeshBasicMaterial({
            color: Math.random() * 0xffffff
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
            (Math.random() - 0.5) * 15,
            (Math.random() - 0.5) * 15,
            (Math.random() - 0.5) * 15
        );
        
        group.add(mesh);
    }
    
    threeScene.add(group);
    currentVisualScene = group;
    console.log('シーン9設定完了');
}

// シーン10: ハイパー・トンネル
function setupScene10() {
    while(threeScene.children.length > 0) {
        const child = threeScene.children[0];
        threeScene.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    }
    
    threeScene.background = new THREE.Color(0x000033);
    
    const group = new THREE.Group();
    
    // 複数のトンネルリング
    for (let i = 0; i < 20; i++) {
        const geometry = new THREE.RingGeometry(1 + i * 0.5, 2 + i * 0.5, 16);
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL((i / 20), 1, 0.5),
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        
        const ring = new THREE.Mesh(geometry, material);
        ring.position.z = -i * 2;
        group.add(ring);
    }
    
    threeScene.add(group);
    currentVisualScene = group;
    console.log('シーン10設定完了');
}

// シーン11: Lightning Storm（新しいかっこいいシーン）
function setupScene11() {
    // 既存オブジェクトを清理（改善版）
    disposeThreeJSScene();
    
    // 背景色設定（嵐の空）
    threeScene.background = new THREE.Color(0x0a0a20);
    
    // メインコンテナ
    const stormContainer = new THREE.Group();
    
    // 稲妻のような線形エフェクト
    for (let i = 0; i < 12; i++) {
        const points = [];
        const startY = 8;
        const endY = -8;
        const segments = 10;
        
        // ジグザグな稲妻パスを生成
        for (let j = 0; j <= segments; j++) {
            const y = startY - (j / segments) * (startY - endY);
            const x = (Math.random() - 0.5) * 6 + Math.sin(j * 0.5) * 2;
            const z = (Math.random() - 0.5) * 6;
            points.push(new THREE.Vector3(x, y, z));
        }
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: new THREE.Color().setHSL(0.6 + i * 0.05, 1, 0.8),
            transparent: true,
            opacity: 0.8,
            linewidth: 3
        });
        
        const lightning = new THREE.Line(geometry, material);
        lightning.userData = {
            type: 'lightning',
            phase: i * 0.3,
            intensity: Math.random() * 0.5 + 0.5
        };
        
        stormContainer.add(lightning);
    }
    
    // エネルギーオーブ（雷の発生源）
    for (let i = 0; i < 6; i++) {
        const geometry = new THREE.SphereGeometry(0.3 + Math.random() * 0.4, 12, 12);
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.65, 1, 0.9),
            transparent: true,
            opacity: 0.9
        });
        
        const orb = new THREE.Mesh(geometry, material);
        orb.position.set(
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 12
        );
        
        orb.userData = {
            type: 'orb',
            originalPosition: orb.position.clone(),
            phase: i * 1.0
        };
        
        stormContainer.add(orb);
    }
    
    // 雷雲パーティクル
    const cloudParticleCount = 300;
    const cloudGeometry = new THREE.BufferGeometry();
    const cloudPositions = new Float32Array(cloudParticleCount * 3);
    const cloudColors = new Float32Array(cloudParticleCount * 3);
    
    for (let i = 0; i < cloudParticleCount; i++) {
        // 雲のような分布
        const radius = Math.random() * 15 + 5;
        const theta = Math.random() * Math.PI * 2;
        const phi = (Math.random() - 0.5) * Math.PI * 0.3; // 平たい分布
        
        cloudPositions[i * 3] = radius * Math.cos(phi) * Math.cos(theta);
        cloudPositions[i * 3 + 1] = radius * Math.sin(phi) + 5; // 上部に配置
        cloudPositions[i * 3 + 2] = radius * Math.cos(phi) * Math.sin(theta);
        
        // 青〜紫の色合い
        const hue = 0.6 + Math.random() * 0.15;
        cloudColors[i * 3] = hue;
        cloudColors[i * 3 + 1] = 0.8;
        cloudColors[i * 3 + 2] = 0.4 + Math.random() * 0.4;
    }
    
    cloudGeometry.setAttribute('position', new THREE.BufferAttribute(cloudPositions, 3));
    cloudGeometry.setAttribute('color', new THREE.BufferAttribute(cloudColors, 3));
    
    const cloudMaterial = new THREE.PointsMaterial({
        size: 6,
        vertexColors: true,
        transparent: true,
        opacity: 0.4
    });
    
    const cloudParticles = new THREE.Points(cloudGeometry, cloudMaterial);
    cloudParticles.userData = { type: 'clouds' };
    stormContainer.add(cloudParticles);
    
    threeScene.add(stormContainer);
    currentVisualScene = stormContainer;
    
    console.log('シーン11設定完了 (Lightning Storm)');
}

// シーン12: サイケデリック・マトリックス
function setupScene12() {
    while(threeScene.children.length > 0) {
        const child = threeScene.children[0];
        threeScene.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    }
    
    threeScene.background = new THREE.Color(0x001a1a);
    
    const group = new THREE.Group();
    
    // マトリックス風の落下エフェクト
    for (let x = -10; x <= 10; x += 1) {
        for (let z = -10; z <= 10; z += 1) {
            const height = Math.random() * 10 + 2;
            const geometry = new THREE.BoxGeometry(0.3, height, 0.3);
            const material = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(0.3 + Math.random() * 0.2, 1, 0.5),
                transparent: true,
                opacity: 0.7
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(x, height / 2, z);
            group.add(mesh);
        }
    }
    
    threeScene.add(group);
    currentVisualScene = group;
    console.log('シーン12設定完了');
}

// 2D UI描画
function drawUI(p) {
    // シーン情報更新
    const sceneNames = ['', 'Pulsar', 'Particle Storm', 'Neon Pulse Rings', 'Neon Strobe', 
                       'Pulse Grid', 'Energy Orbs', 'Laser Beams', 'Plasma Field', 
                       'Strobe Chaos', 'Hyper Tunnel', 'Lightning Storm', 'Cyber Matrix'];
    document.getElementById('scene-info').textContent = `Scene ${AppState.currentScene}: ${sceneNames[AppState.currentScene] || 'Unknown'}`;
    const wireframeStatus = AppState.effects.wireframe ? 'WIRE' : 'SOLID';
    document.getElementById('bpm-info').textContent = `BPM: ${AppState.bpm} | TIME: ${String(AppState.currentTime.hours).padStart(2, '0')}:${String(AppState.currentTime.minutes).padStart(2, '0')}:${String(AppState.currentTime.seconds).padStart(2, '0')} | DAY: ${Math.round(AppState.currentTime.timeOfDay * 100)}% | ${wireframeStatus}`;
    
    // VJコントロールパネル描画
    drawVJPanel(p);
    
    // ビジュアルエフェクトガイド描画
    drawVisualGuide(p);
}

// 最小限UI描画（非侵入的）
function drawVJPanel(p) {
    try {
        p.push();
        
        // 最小パネル背景（小さく、半透明）
        p.fill(0, 0, 0, 60); // 透明度を半分に
        p.noStroke();
        p.rect(10, 10, 120, 80); // サイズを大幅縮小
        
        // 簡素なシーン表示
        p.fill(255, 255, 255, 180);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(8); // フォントサイズ縮小
        p.text(`S:${AppState.currentScene}`, 15, 20);
        
        // シーンボタン（最小限）
        for (let i = 1; i <= 3; i++) {
            const x = 15 + (i - 1) * 15;
            const y = 35;
            const isActive = AppState.currentScene === i;
            
            if (isActive) {
                p.fill(0, 255, 255, 150);
                p.noStroke();
                p.rect(x, y, 12, 12);
            }
            
            p.fill(isActive ? 0 : 200);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(6);
            p.text(i, x + 6, y + 6);
        }
        
        // 簡素なBPM表示
        p.fill(255, 0, 255, 180);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(6);
        p.text(`${AppState.bpm}`, 55, 20);
        
        // シンプルなプレイステータス
        p.fill(AppState.isPlaying ? 255 : 100, 255, 100, 120);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(6);
        p.text(AppState.isPlaying ? '■' : '▶', 80, 20);
        
        // 簡素なエフェクト表示
        p.fill(255, 255, 0, 120);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(5);
        p.text(`V:${Math.round(AppState.audioData.volume * 10)}`, 15, 55);
        p.text(`B:${Math.round(AppState.audioData.bass * 10)}`, 50, 55);
        
        // ヘルプヒント
        if (!AppState.showHelp) {
            p.fill(255, 255, 255, 80);
            p.textSize(6);
            p.text('H: ヘルプ R: リセット B: ランダム W: ワイヤー', 15, 75);
        }
        
        p.pop();
    } catch (e) {
        console.warn('VJパネル描画エラー:', e);
    }
}

// 最小限ガイド表示（非侵入的）
function drawVisualGuide(p) {
    // ガイドを非表示にしてUIを最小限にする
    // ビジュアルに集中できるようにガイドエリアを削除
}

// 簡素なオーディオレベル表示（非侵入的）
function drawDebugInfo(p) {
    try {
        p.push();
        
        // 最小のスペクトラム表示（右下角）
        const barWidth = 30;
        const barHeight = 40;
        const x = window.innerWidth - 100;
        const y = window.innerHeight - 60;
        
        p.noStroke();
        
        // Bass
        p.fill(255, 0, 0, 100);
        p.rect(x, y, barWidth * AppState.audioData.bass, barHeight);
        
        // Mid  
        p.fill(0, 255, 0, 100);
        p.rect(x + 35, y, barWidth * AppState.audioData.mid, barHeight);
        
        // Treble
        p.fill(0, 0, 255, 100);
        p.rect(x + 70, y, barWidth * AppState.audioData.treble, barHeight);
        
        p.pop();
    } catch (e) {
        console.warn('オーディオレベル表示エラー:', e);
    }
}

// ヘルプシステム（画面最下部に横長表示）
function drawHelpSystem(p) {
    try {
        p.push();
        
        // ヘルプパネル背景（画面最下部に横長）
        p.fill(0, 0, 0, 200);
        p.noStroke();
        const panelWidth = window.innerWidth - 40;
        const panelHeight = 120;
        const panelX = 20;
        const panelY = window.innerHeight - panelHeight - 20;
        p.rect(panelX, panelY, panelWidth, panelHeight);
        
        // タイトル
        p.fill(0, 255, 255);
        p.textAlign(p.CENTER, p.TOP);
        p.textSize(12);
        
        // ヘルプテキスト（横並び3列構成）
        p.fill(255, 255, 255);
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(8);
        
        const helpSections = [
            // 左列
            [
            '■ シーン操作:',
                '1-9,0: シーン1-10',
                'F2: シーン11 F3: シーン12',
                'F4: オートモード',
            '←→: 前後のシーン',
            'Enter: ランダムシーン',
            '',
            '■ オーディオ操作:',
            'S: 音楽再生/停止',
                'A/D: BPM調整(-1/+1)',
                '-/+: ボリューム調整'
            ],
            // 中央列
            [
            '■ エフェクト:',
            'Q/W: リバーブ',
            'E/R: フィルター',
            'T/Y: ディストーション',
            'Space: フラッシュ',
            '',
            '■ パターン:',
            'Z: キックパターン',
            'X: ハイハットパターン',
            'C: ベースパターン',
            '',
                '■ 新機能:',
                'R: 表示リセット(BPM以外)',
                'B: BPMランダムトリガー',
                'W: ワイヤーフレーム表示'
            ],
            // 右列
            [
            '■ シーン一覧:',
                '1:Pulsar 2:Particle Storm',
                '3:Neon Pulse Rings 4:Neon Strobe',
                '5:Pulse Grid 6:Energy Orbs',
                '7:Laser Beams 8:Plasma Field',
                '9:Strobe Chaos 10:Hyper Tunnel',
                '11:Lightning Storm 12:Cyber Matrix',
                '',
                '■ 画面エフェクト:',
                'クリック: ランダムエフェクト',
                'リップル/フラッシュ/ズーム/',
                '色シフト/シェイク/爆発'
            ]
        ];
        
        const columnWidth = (panelWidth - 60) / 3;
        const startY = panelY + 25;
        
        for (let col = 0; col < 3; col++) {
            const columnX = panelX + 20 + col * (columnWidth + 10);
            let yOffset = startY;
            
            for (const line of helpSections[col]) {
            if (line === '') {
                    yOffset += 4;
            } else {
                    p.text(line, columnX, yOffset);
                    yOffset += 9;
                }
            }
        }
        
        // ヘルプ閉じるメッセージ
        p.fill(255, 255, 0);
        p.textAlign(p.CENTER, p.BOTTOM);
        p.textSize(9);
        p.text('ヘルプを閉じる: H または ESC', panelX + panelWidth / 2, panelY + panelHeight - 5);
        
        p.pop();
    } catch (e) {
        console.warn('ヘルプシステム描画エラー:', e);
    }
}

// 画面エフェクト更新システム
function updateScreenEffects(p) {
    try {
        p.push();
        
        // リップルエフェクト更新
        for (let i = AppState.visualEffects.ripples.length - 1; i >= 0; i--) {
            const ripple = AppState.visualEffects.ripples[i];
            
            // リップル描画
            p.noFill();
            p.stroke(ripple.color, 100, 100, ripple.opacity * 255);
            p.strokeWeight(3);
            p.circle(ripple.x, ripple.y, ripple.radius * 2);
            
            // リップル更新
            ripple.radius += ripple.speed;
            ripple.opacity -= 0.02;
            
            // 終了済みリップルを削除
            if (ripple.opacity <= 0 || ripple.radius > ripple.maxRadius) {
                AppState.visualEffects.ripples.splice(i, 1);
            }
        }
        
        // 色相シフトエフェクトの減衰
        if (AppState.effects.colorShift > 0) {
            AppState.effects.colorShift *= 0.98;
        }
        
        p.pop();
    } catch (e) {
        console.warn('エフェクト更新エラー:', e);
    }
}

// 画面全体エフェクトシステム（ウルトラダイナミック）
function createClickEffect(p, x, y) {
    try {
        // ランダムエフェクト選択
        const effectType = Math.floor(Math.random() * 6);
        
        switch(effectType) {
            case 0: // リップルエフェクト
                createRippleEffect(p, x, y);
                break;
            case 1: // フラッシュエフェクト
                createFlashEffect();
                break;
            case 2: // ズームパルス
                createZoomPulse();
                break;
            case 3: // 色相シフト
                createColorShift();
                break;
            case 4: // シェイクエフェクト
                createShakeEffect();
                break;
            case 5: // パーティクル爆発
                createParticleExplosion(p, x, y);
                break;
        }
        
        console.log(`エフェクト${effectType}を発動`);
    } catch (e) {
        console.warn('エフェクトシステムエラー:', e);
    }
}

// リップルエフェクト
function createRippleEffect(p, x, y) {
    const ripple = {
        x: x,
        y: y,
        radius: 0,
        maxRadius: Math.max(window.innerWidth, window.innerHeight),
        speed: 20,
        opacity: 1,
        color: Math.random() * 360
    };
    AppState.visualEffects.ripples.push(ripple);
}

// フラッシュエフェクト
function createFlashEffect() {
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xffffff];
    const flashColor = colors[Math.floor(Math.random() * colors.length)];
    
    if (threeScene) {
        threeScene.background.setHex(flashColor);
        setTimeout(() => {
            threeScene.background.setHex(0x000000);
        }, 150);
    }
}

// ズームパルスエフェクト（改善版）
function createZoomPulse() {
    if (currentVisualScene && currentVisualScene.scale) {
        const originalScale = currentVisualScene.scale.x;
        if (typeof originalScale === 'number' && !isNaN(originalScale)) {
        currentVisualScene.scale.multiplyScalar(1.5);
        setTimeout(() => {
                if (currentVisualScene && currentVisualScene.scale) {
                currentVisualScene.scale.setScalar(originalScale);
            }
        }, 200);
        }
    }
}

// 色相シフトエフェクト（強化版）
function createColorShift() {
    AppState.effects.globalHue = Math.random();
    AppState.effects.globalSaturation = Math.random() * 0.5 + 0.5;
    AppState.effects.globalBrightness = Math.random() * 0.5 + 0.5;
    AppState.effects.colorShift = Math.random() * 3; // シフト強度向上
    
    setTimeout(() => {
        AppState.effects.colorShift = 0;
        AppState.effects.globalHue = 0;
        AppState.effects.globalSaturation = 1.0;
        AppState.effects.globalBrightness = 1.0;
    }, 2000); // 時間を延長
}

// ランダムエフェクトコンボ
function triggerRandomEffectCombo() {
    const numEffects = Math.floor(Math.random() * 3) + 1; // 1-3個のエフェクト
    
    for (let i = 0; i < numEffects; i++) {
        setTimeout(() => {
            const effectType = Math.floor(Math.random() * 6);
            switch(effectType) {
                case 0: createFlashEffect(); break;
                case 1: createZoomPulse(); break;
                case 2: createColorShift(); break;
                case 3: createShakeEffect(); break;
                case 4: 
                    // ランダムリップル
                    createRippleEffect(null, Math.random() * window.innerWidth, Math.random() * window.innerHeight);
                    break;
                case 5:
                    // 急激シーン切り替え
                    switchScene(Math.floor(Math.random() * AppState.maxScenes) + 1);
                    break;
            }
        }, i * 200); // 200ms間隔で発動
    }
    
    console.log(`ランダムエフェクトコンボ: ${numEffects}個のエフェクト発動`);
}

// シェイクエフェクト
function createShakeEffect() {
    AppState.camera.shake.x = (Math.random() - 0.5) * 2;
    AppState.camera.shake.y = (Math.random() - 0.5) * 2;
    AppState.camera.shake.z = (Math.random() - 0.5) * 1;
}

// パーティクル爆発エフェクト
function createParticleExplosion(p, x, y) {
    p.push();
    for (let i = 0; i < 30; i++) {
        const angle = (i / 30) * Math.PI * 2;
        const speed = Math.random() * 200 + 50;
        const color = p.color(Math.random() * 360, 80, 100);
        
        p.fill(color);
        p.noStroke();
        
        const particleX = x + Math.cos(angle) * speed * 0.3;
        const particleY = y + Math.sin(angle) * speed * 0.3;
        const size = Math.random() * 20 + 10;
        
        p.circle(particleX, particleY, size);
    }
    p.pop();
}

// フレーズエフェクト
function createPhraseEffect(p, x, y, noteIndex) {
    try {
        p.push();
        
        // 音階に応じた色
        const colors = [
            [255, 100, 100], // C - 赤
            [255, 150, 100], // D - オレンジ
            [255, 255, 100], // E - 黄色
            [100, 255, 100], // F - 緑
            [100, 255, 255], // G - シアン
            [100, 100, 255], // A - 青
            [255, 100, 255], // B - マゼンタ
            [255, 200, 150]  // C - ピーチ
        ];
        
        const color = colors[noteIndex % colors.length];
        p.fill(color[0], color[1], color[2], 180);
        p.noStroke();
        
        // 音階の高さに応じたサイズ
        const size = 20 + noteIndex * 5;
        
        // 放射状エフェクト
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const radius = size * (1 + Math.random() * 0.5);
            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius;
            p.circle(px, py, size * 0.3);
        }
        
        // 中央の大きな円
        p.fill(255, 255, 255, 220);
        p.circle(x, y, size);
        
        p.pop();
    } catch (e) {
        console.warn('フレーズエフェクトエラー:', e);
    }
}

// イベントリスナー設定
function setupEventListeners() {
    document.addEventListener('keydown', handleKeyPress);
    window.addEventListener('resize', handleResize);
    
    // ページ離脱時のクリーンアップ
    window.addEventListener('beforeunload', () => {
        try {
            // シーケンサー停止
            if (audioEngine.sequencer) {
                clearInterval(audioEngine.sequencer);
            }
            
            // オーディオ要素削除
            disposeAudioElements();
            
            // フラグリセット
            audioEngine.isInitialized = false;
            AppState.isPlaying = false;
        } catch (e) {
            // サイレント処理
        }
    });
    
    // ページ非表示時の一時停止
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // ページが非表示になったら音楽停止
            AppState.isPlaying = false;
            if (audioEngine.sequencer) {
                clearInterval(audioEngine.sequencer);
                audioEngine.sequencer = null;
            }
        }
    });
}

// ビジュアルエフェクトシステム
function handleVisualEffects(p, x, y) {
    // エフェクトトリガーエリア（画面下半分）
    if (y > window.innerHeight / 2 && x > 240) {
        const intensity = (window.innerHeight - y) / (window.innerHeight / 2);
        const effectType = Math.floor((x - 240) / (window.innerWidth - 240) * 5);
        
        triggerVisualExplosion(x, y, effectType, intensity);
        return true;
    }
    
    // シーン切り替えエリア（画面上半分右側）
    if (y < window.innerHeight / 2 && x > window.innerWidth - 200) {
        const sceneIndex = Math.floor(y / (window.innerHeight / 2) * 12) + 1; // 12シーン
        if (sceneIndex >= 1 && sceneIndex <= 12) {
            switchScene(sceneIndex);
            console.log(`シーン${sceneIndex}に切り替え`);
        }
        return true;
    }
    
    return false;
}

// UIクリック判定処理
function handleUIClick(p, x, y) {
    // ビジュアルエフェクトシステムチェック
    if (handleVisualEffects(p, x, y)) {
        return true;
    }
    
    // VJパネル領域内かチェック
    if (x >= 20 && x <= 220 && y >= 20 && y <= 170) {
        
        // シーンボタンのクリック判定
        for (let i = 1; i <= 3; i++) {
            const btnX = 30 + (i - 1) * 50;
            const btnY = 50;
            if (x >= btnX && x <= btnX + 40 && y >= btnY && y <= btnY + 30) {
                switchScene(i);
                return true;
            }
        }
        
        // BPM-ボタン
        if (x >= 30 && x <= 60 && y >= 115 && y <= 135) {
            changeBPM(-1); // 1ずつ変化に修正
            return true;
        }
        
        // BPM+ボタン
        if (x >= 140 && x <= 170 && y >= 115 && y <= 135) {
            changeBPM(1); // 1ずつ変化に修正
            return true;
        }
        
        // プレイ/ストップボタン
        if (x >= 180 && x <= 210 && y >= 90 && y <= 120) {
            toggleSequencer();
            return true;
        }
        
        return true; // パネル内のクリックは全てUIとして処理
    }
    
    // エフェクトトリガー領域（画面右側）
    if (x > window.innerWidth - 200) {
        triggerEffect(y / window.innerHeight);
        return true;
    }
    
    return false;
}

// キーボード入力処理
function handleKeyPress(event) {
    switch(event.key) {
        case 's':
        case 'S':
            toggleSequencer();
            break;
        case '1':
            switchScene(1);
            break;
        case '2':
            switchScene(2);
            break;
        case '3':
            switchScene(3);
            break;
        case '4':
            switchScene(4);
            break;
        case '5':
            switchScene(5);
            break;
        case '6':
            switchScene(6);
            break;
        case '7':
            switchScene(7);
            break;
        case '8':
            switchScene(8);
            break;
        case '9':
            switchScene(9);
            break;
        case '0':
            switchScene(10);
            break;
        case 'a':
        case 'A':
            changeBPM(-1); // 1ずつ変化に修正
            break;
        case 'd':
        case 'D':
            changeBPM(1); // 1ずつ変化に修正
            break;
        // VJ操作キー
        case 'q':
        case 'Q':
            adjustEffect('reverb', -0.1);
            break;
        case 'w':
        case 'W':
            adjustEffect('reverb', 0.1);
            break;
        case 'e':
        case 'E':
            adjustEffect('filter', -0.1);
            break;
        case 'r':
        case 'R':
            adjustEffect('filter', 0.1);
            break;
        case 't':
        case 'T':
            adjustEffect('distortion', -0.1);
            break;
        case 'y':
        case 'Y':
            adjustEffect('distortion', 0.1);
            break;
        case ' ': // スペースキー
            event.preventDefault();
            triggerFlashEffect();
            break;
        // パターン切り替え
        case 'z':
        case 'Z':
            audioEngine.currentPatterns.kick = (audioEngine.currentPatterns.kick + 1) % 3;
            console.log(`Kick pattern: ${audioEngine.currentPatterns.kick + 1}`);
            break;
        case 'x':
        case 'X':
            audioEngine.currentPatterns.hihat = (audioEngine.currentPatterns.hihat + 1) % 3;
            console.log(`Hihat pattern: ${audioEngine.currentPatterns.hihat + 1}`);
            break;
        case 'c':
        case 'C':
            audioEngine.currentPatterns.bass = (audioEngine.currentPatterns.bass + 1) % 3;
            console.log(`Bass pattern: ${audioEngine.currentPatterns.bass + 1}`);
            break;
        // ボリューム調整
        case '-':
            AppState.volume = Math.max(0, AppState.volume - 0.1);
            console.log(`Volume: ${Math.round(AppState.volume * 100)}%`);
            break;
        case '=':
        case '+':
            AppState.volume = Math.min(1, AppState.volume + 0.1);
            console.log(`Volume: ${Math.round(AppState.volume * 100)}%`);
            break;
        // 追加ショートカット
        // Fキーでシーン切り替え（既にF1はhelp用途なので変更）
        case 'F2':
            event.preventDefault();
            switchScene(11);
            break;
        case 'F3':
            event.preventDefault();
            switchScene(12);
            break;
        case 'F4':
            event.preventDefault();
            // オートモードトグル
            AppState.autoMode = !AppState.autoMode;
            console.log(`オートモード: ${AppState.autoMode ? 'ON' : 'OFF'}`);
            break;
        case 'ArrowLeft':
            event.preventDefault();
            switchScene(Math.max(1, AppState.currentScene - 1));
            break;
        case 'ArrowRight':
            event.preventDefault();
            switchScene(Math.min(AppState.maxScenes, AppState.currentScene + 1));
            break;
        case 'Enter':
            // ランダムシーン
            switchScene(Math.floor(Math.random() * AppState.maxScenes) + 1);
            break;
        case 'h':
        case 'H':
        case 'F1':
            event.preventDefault();
            AppState.showHelp = !AppState.showHelp;
            console.log(`ヘルプ: ${AppState.showHelp ? '表示' : '非表示'}`);
            break;
        case 'Escape':
            AppState.showHelp = false;
            break;
        // 色変更機能
        case 'u':
        case 'U':
            AppState.effects.globalHue = Math.random();
            console.log('グローバル色相変更:', AppState.effects.globalHue);
            break;
        case 'i':
        case 'I':
            AppState.effects.globalSaturation = Math.random() * 0.5 + 0.5;
            console.log('グローバル彩度変更:', AppState.effects.globalSaturation);
            break;
        case 'o':
        case 'O':
            AppState.effects.globalBrightness = Math.random() * 0.5 + 0.5;
            console.log('グローバル明度変更:', AppState.effects.globalBrightness);
            break;
        case 'p':
        case 'P':
            AppState.effects.randomColorMode = !AppState.effects.randomColorMode;
            console.log('ランダムカラーモード:', AppState.effects.randomColorMode ? 'ON' : 'OFF');
            break;
        case 'l':
        case 'L':
            // ランダムエフェクト発動
            triggerRandomEffectCombo();
            break;
        case 'k':
        case 'K':
            // 色リセット
            AppState.effects.globalHue = 0;
            AppState.effects.globalSaturation = 1.0;
            AppState.effects.globalBrightness = 1.0;
            console.log('色設定リセット');
            break;
        case 'r':
        case 'R':
            // 表示リセット機能（BPM以外）
            resetDisplay();
            break;
        case 'b':
        case 'B':
            // BPMランダムトリガー機能
            toggleRandomTrigger();
            break;
        case 'w':
        case 'W':
            // ワイヤーフレーム表示切り替え
            toggleWireframe();
            break;
    }
}

// シーケンサー再生/停止
function toggleSequencer() {
    AppState.isPlaying = !AppState.isPlaying;
    console.log(`シーケンサー: ${AppState.isPlaying ? '再生' : '停止'}`);
    
    if (AppState.isPlaying) {
        startSequencer();
    } else if (audioEngine.sequencer) {
        clearInterval(audioEngine.sequencer);
        audioEngine.sequencer = null;
    }
}

// 軽量シーケンサー開始
function startSequencer() {
    if (audioEngine.sequencer) {
        clearInterval(audioEngine.sequencer);
    }
    
    const stepDuration = (60 / AppState.bpm / 4) * 1000; // 16th notes
    
    audioEngine.sequencer = setInterval(() => {
        if (!AppState.isPlaying || !audioEngine.isInitialized) {
            clearInterval(audioEngine.sequencer);
            audioEngine.sequencer = null;
            return;
        }
        
        const step = audioEngine.stepCount % 16;
        
        // キックのみ再生（他は負荷軽減のため省略）
        const kickPattern = audioEngine.patterns.kick[audioEngine.currentPatterns.kick];
        if (kickPattern[step]) {
            playKick();
        }
        
        // ハイハットとベースは一部のステップのみ
        if (step % 4 === 2) { // 4分の1の頻度
            if (Math.random() > 0.5) playHihat();
        }
        
        if (step % 8 === 0) { // 8分の1の頻度
            if (Math.random() > 0.3) playBass();
        }
        
        audioEngine.stepCount = (audioEngine.stepCount + 1) % 16;
    }, stepDuration);
}

// キック再生
function playKick() {
    if (audioEngine.kick && audioEngine.kick.started) {
        try {
            audioEngine.kick.amp(0.4 * AppState.volume, 0.01);
            audioEngine.kick.freq(60, 0.01);
            
            setTimeout(() => {
                if (audioEngine.kick && audioEngine.kick.started) {
                    audioEngine.kick.amp(0, 0.1);
                }
            }, 100);
        } catch (e) {
            console.warn('キック再生エラー:', e);
        }
    }
}

// 軽量なハイハット再生（Web Audio API直接使用・改善版）
function playHihat() {
    if (!audioEngine.isInitialized) return;
    
    try {
        // 簡単なノイズバーストでハイハット音を模擬
        const audioContext = getAudioContext();
        if (audioContext && audioContext.state === 'running' && audioContext.destination) {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.frequency.setValueAtTime(8000, audioContext.currentTime);
            oscillator.type = 'square';
            
            gainNode.gain.setValueAtTime(0.1 * AppState.volume, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.05);
        }
    } catch (e) {
        // デバッグモードでのみエラーログ出力
        if (typeof window !== 'undefined' && window.location.search.includes('debug=true')) {
            console.warn('ハイハット再生エラー:', e);
        }
    }
}

// 軽量なベース再生（改善版）
function playBass() {
    if (!audioEngine.isInitialized) return;
    
    try {
        const audioContext = getAudioContext();
        if (audioContext && audioContext.state === 'running' && audioContext.destination) {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            const baseFreqs = [55, 58, 62, 65]; // A minor 低音域
            const freq = baseFreqs[Math.floor(Math.random() * baseFreqs.length)];
            
            oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
            oscillator.type = 'sawtooth';
            
            gainNode.gain.setValueAtTime(0.15 * AppState.volume, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        }
    } catch (e) {
        // デバッグモードでのみエラーログ出力
        if (typeof window !== 'undefined' && window.location.search.includes('debug=true')) {
            console.warn('ベース再生エラー:', e);
        }
    }
}

// ビジュアルエクスプロージョン（touch synthの代替）
function triggerVisualExplosion(x, y, effectType, intensity) {
    // シーン固有の特別エフェクト
    switch(AppState.currentScene) {
        case 4: // ネオンストロボ
            if (currentVisualScene && currentVisualScene.children) {
                currentVisualScene.children.forEach(child => {
                    child.material.opacity = 1.0;
                    child.material.color.setHex(Math.random() * 0xffffff);
                });
            }
            break;
            
        case 9: // ストロボカオス
            // 新しいランダムオブジェクトを生成
            if (currentVisualScene && currentVisualScene.children.length < 100) {
                const geometry = new THREE.BoxGeometry(Math.random() * 0.3, Math.random() * 0.3, Math.random() * 0.3);
                const material = new THREE.MeshBasicMaterial({ color: Math.random() * 0xffffff });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
                currentVisualScene.add(mesh);
            }
            break;
            
        default:
            // 汎用フラッシュエフェクト
            AppState.effects.flashTrigger = true;
            AppState.camera.shake.x = (Math.random() - 0.5) * 0.3 * intensity;
            AppState.camera.shake.y = (Math.random() - 0.5) * 0.3 * intensity;
            break;
    }
}

// シーン切り替え状態管理
let isSceneSwitching = false;
let sceneTransitionTimeoutIds = [];

// 強化されたシーン切り替え（トランジション付き・改善版）
async function switchScene(sceneNumber) {
    if (AppState.currentScene === sceneNumber || isSceneSwitching) return;
    
    console.log(`シーン${sceneNumber}に切り替え`);
    isSceneSwitching = true;
    
    // 既存のトランジションタイムアウトをクリア
    sceneTransitionTimeoutIds.forEach(id => clearTimeout(id));
    sceneTransitionTimeoutIds = [];
    
    try {
    // 強化されたフラッシュトランジション
    if (threeScene && threeScene.background) {
        // ホワイトフラッシュでトランジション
        threeScene.background.setHex(0xffffff);
        
            await new Promise(resolve => {
                const timeoutId = setTimeout(() => {
                    if (threeScene && threeScene.background) {
            threeScene.background.setHex(0x000000);
                    }
                    resolve();
                }, 50);
                sceneTransitionTimeoutIds.push(timeoutId);
            });
            
            await new Promise(resolve => {
                const timeoutId = setTimeout(() => {
                AppState.currentScene = sceneNumber;
                
                switch(sceneNumber) {
                    case 1: setupScene1(); break;
                    case 2: setupScene2(); break;
                    case 3: setupScene3(); break;
                    case 4: setupScene4(); break;
                    case 5: setupScene5(); break;
                    case 6: setupScene6(); break;
                    case 7: setupScene7(); break;
                    case 8: setupScene8(); break;
                    case 9: setupScene9(); break;
                    case 10: setupScene10(); break;
                    case 11: setupScene11(); break;
                    case 12: setupScene12(); break;
                    default: setupScene1(); break;
                }
                
                // カメラリセット
                if (sceneNumber === 3) {
                        if (threeCamera) {
                    threeCamera.position.set(0, 0, -5);
                    threeCamera.lookAt(0, 0, 10);
                        }
                } else {
                    AppState.camera.spherical.radius = 5;
                    AppState.camera.spherical.theta = 0;
                    AppState.camera.spherical.phi = Math.PI / 2;
                    updateCameraPosition();
                }
                
                                        // シーン切り替え時のエフェクトトリガー
                        AppState.effects.flashTrigger = true;
                        AppState.camera.shake.x = (Math.random() - 0.5) * 0.5;
                        AppState.camera.shake.y = (Math.random() - 0.5) * 0.5;
                        
                        // ワイヤーフレーム設定を新しいシーンに適用
                        setTimeout(() => {
                            applyWireframeToAllMaterials();
                        }, 100);
                    
                    resolve();
            }, 50);
                sceneTransitionTimeoutIds.push(timeoutId);
            });
        }
    } catch (error) {
        console.warn('シーン切り替えエラー:', error);
    } finally {
        isSceneSwitching = false;
        sceneTransitionTimeoutIds = [];
    }
}

// 表示リセット機能（BPM以外をリセット）
function resetDisplay() {
    try {
        // 現在のBPMを保存
        const currentBPM = AppState.bpm;
        
        // AppStateをリセット（BPM以外）
        AppState.currentScene = 1;
        AppState.isPlaying = false;
        AppState.volume = 0.7;
        AppState.autoMode = false;
        AppState.showHelp = false;
        
        // エフェクトをリセット
        AppState.effects = {
            reverb: 0,
            filter: 0.5,
            distortion: 0,
            intensity: 1.0,
            colorShift: 0,
            flashTrigger: false,
                                globalHue: 0,
            globalSaturation: 1.0,
            globalBrightness: 1.0,
            randomColorMode: false,
            wireframe: false
        };
        
        // オーディオデータをリセット
        AppState.audioData = {
            bass: 0,
            mid: 0,
            treble: 0,
            waveform: [],
            volume: 0,
            peak: 0,
            beatDetected: false
        };
        
        // ビジュアルエフェクトをリセット
        AppState.visualEffects = {
            explosions: [],
            flashes: [],
            trails: [],
            screenEffects: [],
            ripples: [],
            colorShifts: []
        };
        
        // カメラをリセット
        AppState.camera = {
            target: { x: 0, y: 0, z: 0 },
            spherical: {
                radius: 5,
                theta: 0,
                phi: Math.PI / 2
            },
            shake: { x: 0, y: 0, z: 0 },
            isDragging: false,
            lastMouse: { x: 0, y: 0 }
        };
        
        // 時間をリセット
        AppState.time = 0;
        
        // BPMを復元
        AppState.bpm = currentBPM;
        
        // オーディオパターンをリセット
        audioEngine.currentPatterns = { kick: 0, hihat: 0, bass: 0 };
        audioEngine.stepCount = 0;
        
        // シーケンサーを停止
        if (audioEngine.sequencer) {
            clearInterval(audioEngine.sequencer);
            audioEngine.sequencer = null;
        }
        
        // BPMランダムトリガーを停止
        if (randomTriggerInterval) {
            clearInterval(randomTriggerInterval);
            randomTriggerInterval = null;
            isRandomTriggerActive = false;
        }
        
        // シーン1に切り替え
        switchScene(1);
        
        console.log('表示リセット完了（BPMは保持: ' + currentBPM + '）');
    } catch (e) {
        console.warn('表示リセットエラー:', e);
    }
}

// BPMランダムトリガー機能
function toggleRandomTrigger() {
    if (isRandomTriggerActive) {
        // ランダムトリガーを停止
        if (randomTriggerInterval) {
            clearInterval(randomTriggerInterval);
            randomTriggerInterval = null;
        }
        isRandomTriggerActive = false;
        console.log('BPMランダムトリガー停止');
    } else {
        // ランダムトリガーを開始
        startRandomTrigger();
        isRandomTriggerActive = true;
        console.log('BPMランダムトリガー開始');
    }
}

// BPMに合わせたランダムトリガーの実行
function startRandomTrigger() {
    if (randomTriggerInterval) {
        clearInterval(randomTriggerInterval);
    }
    
    // BPMに基づく間隔計算（4分音符の間隔）
    const quarterNoteInterval = (60 / AppState.bpm) * 1000;
    
    randomTriggerInterval = setInterval(() => {
        if (!isRandomTriggerActive) {
            clearInterval(randomTriggerInterval);
            randomTriggerInterval = null;
            return;
        }
        
        // ランダムアクションを実行（ワイヤーフレーム強化版）
        const actions = [
            () => switchScene(Math.floor(Math.random() * AppState.maxScenes) + 1), // ランダムシーン
            () => {
                // ランダムエフェクト調整
                const effects = ['reverb', 'filter', 'distortion'];
                const effect = effects[Math.floor(Math.random() * effects.length)];
                AppState.effects[effect] = Math.random();
            },
            () => {
                // ランダムカラー設定
                AppState.effects.globalHue = Math.random();
                AppState.effects.globalSaturation = Math.random() * 0.5 + 0.5;
                AppState.effects.globalBrightness = Math.random() * 0.5 + 0.5;
            },
            () => {
                // ランダムパターン変更
                audioEngine.currentPatterns.kick = Math.floor(Math.random() * 3);
                audioEngine.currentPatterns.hihat = Math.floor(Math.random() * 3);
                audioEngine.currentPatterns.bass = Math.floor(Math.random() * 3);
            },
            () => {
                // フラッシュエフェクト
                triggerFlashEffect();
            },
            () => {
                // ランダムエフェクトコンボ
                triggerRandomEffectCombo();
            },
            () => {
                // ボリューム調整
                AppState.volume = Math.random() * 0.5 + 0.5;
            },
            () => {
                // ワイヤーフレーム切り替え（基本）
                toggleWireframe();
            },
            () => {
                // ワイヤーフレーム切り替え（重複で頻度アップ）
                toggleWireframe();
            },
            () => {
                // ワイヤーフレーム + エフェクトコンボ
                toggleWireframe();
                // ワイヤーフレーム時は特別な色彩効果を追加
                if (AppState.effects.wireframe) {
                    AppState.effects.globalHue = Math.random();
                    AppState.effects.globalSaturation = 0.8 + Math.random() * 0.2;
                    AppState.effects.globalBrightness = 0.7 + Math.random() * 0.3;
                }
            },
            () => {
                // ワイヤーフレーム専用ランダムエフェクト
                if (Math.random() < 0.4) { // 40%の確率でワイヤーフレームをONにしてエフェクト
                    if (!AppState.effects.wireframe) {
                        toggleWireframe();
                    }
                    // ワイヤーフレーム時の特別なエフェクト
                    triggerFlashEffect();
                    AppState.effects.globalHue = Math.random() * 0.3 + 0.5; // 青〜紫系
                    AppState.effects.intensity = 1.5 + Math.random() * 0.5;
                } else if (AppState.effects.wireframe && Math.random() < 0.6) {
                    // ワイヤーフレームをOFFに戻す（確率アップ）
                    toggleWireframe();
                }
            },
            () => {
                // オートモードトグル
                AppState.autoMode = !AppState.autoMode;
            }
        ];
        
        // ランダムにアクションを選択して実行
        const action = actions[Math.floor(Math.random() * actions.length)];
        action();
        
    }, quarterNoteInterval);
}

// ワイヤーフレーム表示切り替え
function toggleWireframe() {
    AppState.effects.wireframe = !AppState.effects.wireframe;
    console.log(`ワイヤーフレーム表示: ${AppState.effects.wireframe ? 'ON' : 'OFF'}`);
    
    // 全てのマテリアルにワイヤーフレーム設定を適用
    applyWireframeToAllMaterials();
    
    // ワイヤーフレーム切り替え時の特別エフェクト
    if (AppState.effects.wireframe) {
        // ワイヤーフレームON時のエフェクト
        triggerWireframeOnEffect();
    } else {
        // ワイヤーフレームOFF時のエフェクト
        triggerWireframeOffEffect();
    }
}

// ワイヤーフレームON時の特別エフェクト
function triggerWireframeOnEffect() {
    // フラッシュエフェクト
    AppState.effects.flashTrigger = true;
    
    // 背景を一時的にサイバー系の色に
    if (threeScene && threeScene.background) {
        threeScene.background.setHex(0x001122);
        setTimeout(() => {
            if (threeScene && threeScene.background) {
                threeScene.background.setHex(0x000000);
            }
        }, 200);
    }
    
    // カメラシェイク
    AppState.camera.shake.x = (Math.random() - 0.5) * 0.3;
    AppState.camera.shake.y = (Math.random() - 0.5) * 0.3;
    
    // 色彩をサイバー系に調整
    AppState.effects.globalHue = 0.5 + Math.random() * 0.2; // 青〜シアン系
    AppState.effects.globalSaturation = 0.9;
    AppState.effects.globalBrightness = 1.2;
}

// ワイヤーフレームOFF時の特別エフェクト
function triggerWireframeOffEffect() {
    // ソフトフラッシュエフェクト
    if (threeScene && threeScene.background) {
        threeScene.background.setHex(0x111111);
        setTimeout(() => {
            if (threeScene && threeScene.background) {
                threeScene.background.setHex(0x000000);
            }
        }, 150);
    }
    
    // 色彩を通常に戻す
    AppState.effects.globalHue = 0;
    AppState.effects.globalSaturation = 1.0;
    AppState.effects.globalBrightness = 1.0;
}

// 全マテリアルにワイヤーフレーム設定を適用
function applyWireframeToAllMaterials() {
    if (!threeScene) return;
    
    threeScene.traverse((object) => {
        if (object.material) {
            if (Array.isArray(object.material)) {
                // 複数マテリアルの場合
                object.material.forEach(material => {
                    if (material.wireframe !== undefined) {
                        material.wireframe = AppState.effects.wireframe;
                    }
                });
            } else {
                // 単一マテリアルの場合
                if (object.material.wireframe !== undefined) {
                    object.material.wireframe = AppState.effects.wireframe;
                }
            }
        }
    });
}

// BPM変更（ランダムトリガーの間隔も更新）
function changeBPM(delta) {
    AppState.bpm = Math.max(60, Math.min(200, AppState.bpm + delta));
    console.log(`BPM: ${AppState.bpm}`);
    
    // シーケンサーが再生中の場合は再起動
    if (AppState.isPlaying) {
        clearInterval(audioEngine.sequencer);
        startSequencer();
    }
    
    // ランダムトリガーが有効な場合は間隔を更新
    if (isRandomTriggerActive) {
        startRandomTrigger();
    }
}

// エフェクト調整
function adjustEffect(type, delta) {
    AppState.effects[type] = Math.max(0, Math.min(1, AppState.effects[type] + delta));
    console.log(`${type}: ${Math.round(AppState.effects[type] * 100)}%`);
}

// エフェクトトリガー
function triggerEffect(intensity) {
    const effectType = intensity < 0.33 ? 'reverb' : intensity < 0.66 ? 'filter' : 'distortion';
    AppState.effects[effectType] = Math.random() * 0.5 + 0.5;
    console.log(`エフェクトトリガー: ${effectType}`);
}

// フラッシュエフェクト
function triggerFlashEffect() {
    if (threeScene) {
        const originalColor = threeScene.background.clone();
        threeScene.background.setHex(0xffffff);
        
        setTimeout(() => {
            threeScene.background.copy(originalColor);
        }, 100);
    }
}

// ウィンドウリサイズ処理
function handleResize() {
    threeCamera.aspect = window.innerWidth / window.innerHeight;
    threeCamera.updateProjectionMatrix();
    threeRenderer.setSize(window.innerWidth, window.innerHeight);
    
    if (p5Instance) {
        p5Instance.resizeCanvas(window.innerWidth, window.innerHeight);
    }
}

// メインアニメーションループ（フレームレート制限付き・改善版）
let lastFrameTime = 0;
const baseFPS = 30;
const highQualityFPS = 60;

function animate(currentTime) {
    requestAnimationFrame(animate);
    
    // シーンに応じたフレームレート決定
    const isHighQualityScene = AppState.currentScene === 3 || AppState.currentScene === 7 || AppState.currentScene === 11;
    const targetFPS = isHighQualityScene ? highQualityFPS : baseFPS;
    const frameInterval = 1000 / targetFPS;
    
    // フレームレート制限
    if (currentTime - lastFrameTime < frameInterval) {
        return;
    }
    lastFrameTime = currentTime;
    
    // Three.jsシーンの更新
    updateThreeJSScene();
    
    // レンダリング
    threeRenderer.render(threeScene, threeCamera);
}

// カメラ位置更新（球面座標からデカルト座標）
function updateCameraPosition() {
    const spherical = AppState.camera.spherical;
    const target = AppState.camera.target;
    
    const x = target.x + spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
    const y = target.y + spherical.radius * Math.cos(spherical.phi);
    const z = target.z + spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
    
    threeCamera.position.set(x, y, z);
    threeCamera.lookAt(target.x, target.y, target.z);
}

// 現在時刻更新システム
function updateCurrentTime() {
    const now = new Date();
    AppState.currentTime.hours = now.getHours();
    AppState.currentTime.minutes = now.getMinutes();
    AppState.currentTime.seconds = now.getSeconds();
    AppState.currentTime.milliseconds = now.getMilliseconds();
    
    // 総秒数計算（ミリ秒込み）
    AppState.currentTime.totalSeconds = 
        AppState.currentTime.hours * 3600 + 
        AppState.currentTime.minutes * 60 + 
        AppState.currentTime.seconds + 
        AppState.currentTime.milliseconds / 1000;
    
    // 一日の時間を0-1で表現
    AppState.currentTime.timeOfDay = AppState.currentTime.totalSeconds / 86400; // 86400 = 24*60*60
}

// Three.jsシーン更新
function updateThreeJSScene() {
    // シーン3以外でカメラ更新
    if (AppState.currentScene === 1 || AppState.currentScene === 2) {
        updateCameraPosition();
    }
    
    // 時間更新
    AppState.time += 0.016; // 約60fps想定
    
    // 現在時刻更新
    updateCurrentTime();
    
    // ビート検出とフラッシュエフェクト
    detectBeatsAndEffects();
    
    // シーン別更新処理
    switch (AppState.currentScene) {
        case 1: updateScene1(); break;
        case 2: updateScene2(); break; 
        case 3: updateScene3(); break;
        case 4: updateScene4(); break;
        case 5: updateScene5(); break;
        case 6: updateScene6(); break;
        case 7: updateScene7(); break;
        case 8: updateScene8(); break;
        case 9: updateScene9(); break;
        case 10: updateScene10(); break;
        case 11: updateScene11(); break;
        case 12: updateScene12(); break;
    }
    
    // カメラシェイク効果
    applyCameraShake();
}

// シーン1更新（ウルトラダイナミック・時刻連動版）
function updateScene1() {
    if (currentVisualScene && currentVisualScene.material && currentVisualScene.scale) {
        // 時刻による基本変化
        const timeInfluence = AppState.currentTime.timeOfDay;
        const hourCycle = Math.sin(AppState.currentTime.hours * Math.PI / 12); // 12時間周期
        const minuteCycle = Math.sin(AppState.currentTime.minutes * Math.PI / 30); // 30分周期
        
        // 極端なBassに反応するスケール変化（時刻で基本スケール調整）
        const baseScale = 0.8 + timeInfluence * 0.4; // 時刻で基本サイズ変化
        const scale = baseScale + AppState.audioData.bass * 8;
        currentVisualScene.scale.setScalar(scale);
        
        // 急激な発光色変化（時刻で色相ベース調整）
        const emissiveIntensity = AppState.audioData.bass * 2.0;
        const timeHue = timeInfluence + hourCycle * 0.1; // 時刻ベースの色相
        const hue = (timeHue + AppState.time * 0.3 + AppState.audioData.treble * 5) % 1;
        currentVisualScene.material.emissive.setHSL(hue, 1, emissiveIntensity);
        
        // 急速回転アニメーション（時刻で回転速度調整）
        const timeRotationSpeed = 1 + minuteCycle * 0.5;
        currentVisualScene.rotation.x += (0.05 + AppState.audioData.mid * 0.3) * timeRotationSpeed;
        currentVisualScene.rotation.y += (0.05 + AppState.audioData.treble * 0.25) * timeRotationSpeed;
        
        // 急激な色相変化（時刻で彩度・明度調整）
        const colorHue = (timeInfluence + AppState.time * 0.2 + AppState.audioData.bass * 3) % 1;
        const saturation = (0.8 + AppState.audioData.mid * 0.2) * (0.7 + timeInfluence * 0.3);
        const lightness = (0.5 + AppState.audioData.volume * 0.5) * (0.6 + hourCycle * 0.4);
        currentVisualScene.material.color.setHSL(colorHue, saturation, lightness);
        
        // ビート時の急激フラッシュ
        if (AppState.audioData.beatDetected && AppState.audioData.bass > 0.7) {
            currentVisualScene.material.emissive.setRGB(1, 1, 1);
            setTimeout(() => {
                if (currentVisualScene && currentVisualScene.material) {
                    currentVisualScene.material.emissive.setRGB(0, 0, 0);
                }
            }, 100);
        }
    }
}

// シーン2更新（パフォーマンス最適化・時刻連動版）
function updateScene2() {
    if (particleSystem && particleSystem.geometry.attributes.position) {
        const positions = particleSystem.geometry.attributes.position.array;
        const velocities = particleSystem.geometry.attributes.velocity.array;
        const colors = particleSystem.geometry.attributes.color.array;
        
        // 時刻による影響
        const timeInfluence = AppState.currentTime.timeOfDay;
        const secondsCycle = Math.sin(AppState.currentTime.seconds * Math.PI / 30); // 30秒周期
        const minutesCycle = Math.cos(AppState.currentTime.minutes * Math.PI / 30); // 30分周期
        
        const musicFactor = (1 + AppState.audioData.mid * 2) * (0.8 + timeInfluence * 0.4);
        const bassLevel = AppState.audioData.bass;
        const midLevel = AppState.audioData.mid;
        const trebleLevel = AppState.audioData.treble;
        
        // パーティクル更新（適応的間引き処理でパフォーマンス向上）
        const particleCount = positions.length / 3;
        const updateStep = Math.max(1, Math.min(5, Math.floor(particleCount / 200)));
        
        for (let i = 0; i < positions.length; i += 3 * updateStep) {
            // 位置更新（時刻で動きパターン変化）
            const timeMovement = 1 + secondsCycle * 0.3;
            positions[i] += velocities[i] * musicFactor * timeMovement;
            positions[i + 1] += velocities[i + 1] * musicFactor * timeMovement;
            positions[i + 2] += velocities[i + 2] * musicFactor * timeMovement;
            
            // 範囲制限
            const boundary = 15 * (0.8 + timeInfluence * 0.4); // 時刻で境界変化
            if (Math.abs(positions[i]) > boundary) velocities[i] *= -1;
            if (Math.abs(positions[i + 1]) > boundary) velocities[i + 1] *= -1;
            if (Math.abs(positions[i + 2]) > boundary) velocities[i + 2] *= -1;
            
            // 色の変化（音楽と時刻に応じて）
            const colorIndex = Math.floor(i / 3);
            if (colors[colorIndex * 3] !== undefined) {
                colors[colorIndex * 3] = bassLevel * (0.7 + timeInfluence * 0.3);
                colors[colorIndex * 3 + 1] = midLevel * (0.8 + minutesCycle * 0.2);
                colors[colorIndex * 3 + 2] = trebleLevel * (0.6 + secondsCycle * 0.4);
            }
        }
        
        particleSystem.geometry.attributes.position.needsUpdate = true;
        particleSystem.geometry.attributes.color.needsUpdate = true;
        
        // 極端なサイズ変更（時刻で基本サイズ調整）
        const timeSize = 1 + timeInfluence * 2;
        particleSystem.material.size = (3 + AppState.audioData.volume * 15 + Math.sin(AppState.time * 10) * 3) * timeSize;
        
        // 急激なグループスケールと回転（時刻影響）
        const groupScale = (1 + AppState.audioData.bass * 1.5) * (0.8 + timeInfluence * 0.4);
        particleSystem.scale.setScalar(groupScale);
        particleSystem.rotation.y += AppState.audioData.treble * 0.2 * (1 + minutesCycle * 0.5);
        particleSystem.rotation.x += AppState.audioData.mid * 0.15 * (1 + secondsCycle * 0.3);
        
        // ビート時の急激エフェクト
        if (AppState.audioData.beatDetected) {
            particleSystem.material.opacity = 1.0;
            particleSystem.scale.multiplyScalar(1.5 * (1 + timeInfluence * 0.2));
        } else {
            particleSystem.material.opacity = 0.8 * (0.7 + timeInfluence * 0.3);
        }
    }
}

// フラッシュ効果の管理
let flashTimeoutId = null;
let isFlashing = false;

// BPMランダムトリガー機能
let randomTriggerInterval = null;
let isRandomTriggerActive = false;

// ビート検出とエフェクト処理（改善版）
function detectBeatsAndEffects() {
    const bass = AppState.audioData.bass;
    const volume = AppState.audioData.volume;
    
    // 超強化されたビート検出（ダイナミック）
    if (bass > 0.3) { // さらに闾値を下げて反応性向上
        AppState.audioData.beatDetected = true;
        
        // 超強化カメラシェイク（ダイナミック）
        AppState.camera.shake.x = (Math.random() - 0.5) * 1.0 * bass; // 2.5倍に強化
        AppState.camera.shake.y = (Math.random() - 0.5) * 1.0 * bass;
        AppState.camera.shake.z = (Math.random() - 0.5) * 0.5 * bass;
        
        // 急激な背景色変化（競合状態を防ぐ改善版）
        if (bass > 0.7 && !isFlashing && threeScene && threeScene.background) {
            isFlashing = true;
            const flashColor = Math.random() * 0xffffff;
            threeScene.background.setHex(flashColor);
            
            // 前のタイムアウトをクリア
            if (flashTimeoutId) {
                clearTimeout(flashTimeoutId);
            }
            
            flashTimeoutId = setTimeout(() => {
                if (threeScene && threeScene.background) {
                threeScene.background.setHex(0x000000);
                }
                isFlashing = false;
                flashTimeoutId = null;
            }, 50);
        }
        
        // 強化されたフラッシュエフェクト
        if (bass > 0.5) { // 闾値を下げて頻度向上
            AppState.effects.flashTrigger = true;
        }
    } else {
        AppState.audioData.beatDetected = false;
        AppState.effects.flashTrigger = false;
    }
    
    // カメラシェイクの減衰
    AppState.camera.shake.x *= 0.9;
    AppState.camera.shake.y *= 0.9;
    AppState.camera.shake.z *= 0.9;
    
    // オートモード（自動シーン切り替え・精度改善版）
    if (AppState.autoMode && AppState.time > 0) {
        const currentSecond = Math.floor(AppState.time);
        const previousSecond = Math.floor(AppState.time - 0.016);
        
        // 15秒毎のチェック（浮動小数点誤差を考慮）
        if (currentSecond % 15 === 0 && currentSecond !== previousSecond) {
        // 15秒毎にランダムシーン切り替え
        const newScene = Math.floor(Math.random() * AppState.maxScenes) + 1;
        if (newScene !== AppState.currentScene) {
            switchScene(newScene);
            }
        }
    }
}

// カメラシェイク適用
function applyCameraShake() {
    if (AppState.currentScene !== 3) { // シーン3以外
        threeCamera.position.x += AppState.camera.shake.x;
        threeCamera.position.y += AppState.camera.shake.y;
        threeCamera.position.z += AppState.camera.shake.z;
    }
}

// シーン3更新（Neon Pulse Rings - 時刻連動版）
function updateScene3() {
    if (currentVisualScene && currentVisualScene.children) {
        // 時刻による影響
        const timeInfluence = AppState.currentTime.timeOfDay;
        const hourCycle = Math.sin(AppState.currentTime.hours * Math.PI / 12);
        const minuteCycle = Math.cos(AppState.currentTime.minutes * Math.PI / 30);
        const secondsCycle = Math.sin(AppState.currentTime.seconds * Math.PI / 30);
        
        currentVisualScene.children.forEach((child, index) => {
            if (child.userData.type === 'core') {
                // 中央コアの動的変化（時刻で基本スケール調整）
                const timeScale = 0.8 + timeInfluence * 0.4;
                const scale = timeScale + AppState.audioData.bass * 2;
                child.scale.setScalar(scale);
                
                // 色相変化（時刻ベースの色相）
                const timeHue = timeInfluence + hourCycle * 0.2;
                const hue = (timeHue + AppState.time * 0.2 + AppState.audioData.treble * 2) % 1;
                child.material.color.setHSL(hue, 1, 0.8 * (0.7 + timeInfluence * 0.3));
                
                // 発光強度（時刻で基本強度調整）
                child.material.opacity = (0.7 + AppState.audioData.volume * 0.3) * (0.8 + timeInfluence * 0.2);
                
                // 回転（時刻で速度調整）
                const timeRotSpeed = 1 + minuteCycle * 0.3;
                child.rotation.x += (0.02 + AppState.audioData.mid * 0.1) * timeRotSpeed;
                child.rotation.y += (0.03 + AppState.audioData.treble * 0.08) * timeRotSpeed;
            }
            else if (child.userData.type === 'particles') {
                // パーティクルの動的変化（時刻でサイズ基準調整）
                const timeSize = 1 + timeInfluence * 1.5;
                child.material.size = (3 + AppState.audioData.volume * 5) * timeSize;
                child.material.opacity = (0.5 + AppState.audioData.mid * 0.5) * (0.6 + timeInfluence * 0.4);
                
                // 回転（時刻で回転パターン変化）
                child.rotation.y += (0.01 + AppState.audioData.bass * 0.05) * (1 + secondsCycle * 0.4);
                child.rotation.z += (0.005 + AppState.audioData.treble * 0.03) * (1 + minuteCycle * 0.3);
            }
            else if (child.geometry && child.geometry.type === 'RingGeometry') {
                // ネオンリングの動的変化
                const userData = child.userData;
                const bassImpact = AppState.audioData.bass * 3;
                const midImpact = AppState.audioData.mid * 2;
                
                // 動的スケール（音楽と時刻に反応）
                const timePulse = 1 + secondsCycle * 0.2;
                const pulseScale = timePulse + bassImpact * 0.3 + Math.sin(AppState.time * userData.speed + userData.phase) * 0.2;
                child.scale.setScalar(pulseScale);
                
                // 色相変化（各リングが時刻と異なる速度で変化）
                const timeHueOffset = timeInfluence * (index + 1) * 0.1;
                const baseHue = (index / 8) + timeHueOffset + (AppState.time * 0.1) + (AppState.audioData.treble * 1.5);
                const hue = (baseHue + AppState.effects.globalHue + hourCycle * 0.1) % 1;
                const saturation = (0.8 + midImpact * 0.2) * (0.7 + timeInfluence * 0.3);
                const lightness = (0.4 + bassImpact * 0.4) * (0.6 + minuteCycle * 0.4);
                
            child.material.color.setHSL(hue, saturation, lightness);
                
                // 透明度の変化（時刻で基本透明度調整）
                child.material.opacity = (0.6 + AppState.audioData.volume * 0.4) * (0.7 + timeInfluence * 0.3);
                
                // 個別回転（時刻で回転速度調整）
                const timeRotationFactor = 1 + hourCycle * 0.2;
                child.rotation.z += (userData.speed + AppState.audioData.treble * 0.1) * timeRotationFactor;
                
                // ビート時の特別効果
                if (AppState.audioData.beatDetected) {
                    child.material.opacity = 1.0;
                    child.scale.multiplyScalar(1.2 * (1 + timeInfluence * 0.1));
                }
            }
        });
        
        // グループ全体の回転（時刻で基本回転速度調整）
        const globalTimeRotation = 1 + timeInfluence * 0.3;
        currentVisualScene.rotation.x += (0.005 + AppState.audioData.mid * 0.02) * globalTimeRotation;
        currentVisualScene.rotation.y += (0.008 + AppState.audioData.bass * 0.03) * globalTimeRotation;
    }
}

// シーン4更新（ウルトラダイナミックネオン・時刻連動版）
function updateScene4() {
    if (currentVisualScene && currentVisualScene.children) {
        const beat = AppState.audioData.beatDetected;
        const bassLevel = AppState.audioData.bass;
        
        // 時刻による影響
        const timeInfluence = AppState.currentTime.timeOfDay;
        const hourCycle = Math.cos(AppState.currentTime.hours * Math.PI / 12);
        const minuteCycle = Math.sin(AppState.currentTime.minutes * Math.PI / 30);
        
        currentVisualScene.children.forEach((child, index) => {
            // 急激ストロボ効果（時刻で強度調整）
            const timeStrobeIntensity = 0.7 + timeInfluence * 0.6;
            if (beat && bassLevel > 0.6) {
                child.material.opacity = Math.random() * timeStrobeIntensity;
                child.material.color.setHex(Math.random() * 0xffffff);
            } else {
                child.material.opacity = (0.1 + AppState.audioData.mid * 2.0) * timeStrobeIntensity;
            }
            
            // 急激色変化（時刻で色相ベース調整）
            const timeHueBase = timeInfluence + hourCycle * 0.2;
            const hue = (timeHueBase + AppState.time * 0.8 + index * 0.2 + bassLevel * 10) % 1;
            const saturation = (0.8 + AppState.audioData.treble * 0.2) * (0.8 + timeInfluence * 0.2);
            const brightness = (0.3 + AppState.audioData.volume * 1.2) * (0.7 + minuteCycle * 0.3);
            child.material.color.setHSL(hue, saturation, brightness);
            
            // 急激位置変化（時刻で動きパターン変化）
            const timeMovement = 1 + timeInfluence * 0.5;
            child.position.y += Math.sin(AppState.time * 8 + index) * 0.1 * timeMovement;
            child.rotation.x += bassLevel * 0.8 * (1 + hourCycle * 0.3);
            child.rotation.y += AppState.audioData.treble * 0.6 * (1 + minuteCycle * 0.4);
            child.rotation.z += AppState.audioData.mid * 0.4 * timeMovement;
            
            // 急激スケール変化（時刻で基本スケール調整）
            const timeScale = 0.8 + timeInfluence * 0.4;
            const scale = timeScale + bassLevel * 2.0;
            child.scale.setScalar(scale);
            
            // ビート時のジャンプエフェクト（時刻で強度調整）
            if (beat) {
                const jumpIntensity = 1 + timeInfluence * 0.5;
                child.position.x += (Math.random() - 0.5) * 2 * jumpIntensity;
                child.position.z += (Math.random() - 0.5) * 2 * jumpIntensity;
            }
        });
        
        // 急激グループ回転（時刻で回転速度調整）
        const timeRotationFactor = 1 + timeInfluence * 0.4;
        currentVisualScene.rotation.y += AppState.audioData.mid * 0.15 * timeRotationFactor;
        currentVisualScene.rotation.x += AppState.audioData.bass * 0.1 * (1 + hourCycle * 0.2);
    }
}

// シーン5更新（強化されたパルス・グリッド・時刻連動版）
function updateScene5() {
    if (currentVisualScene && currentVisualScene.children) {
        // 時刻による影響
        const timeInfluence = AppState.currentTime.timeOfDay;
        const minuteCycle = Math.sin(AppState.currentTime.minutes * Math.PI / 30);
        const secondsCycle = Math.cos(AppState.currentTime.seconds * Math.PI / 30);
        
        currentVisualScene.children.forEach((child, index) => {
            // 強化されたY軸スケール（時刻で基本高さ調整）
            const timeHeight = 0.7 + timeInfluence * 0.6;
            const pulse = timeHeight + AppState.audioData.bass * 6;
            child.scale.y = pulse;
            
            // X、Z軸スケール（時刻で基本サイズ調整）
            const timeSize = 0.8 + timeInfluence * 0.4;
            const sidePulse = timeSize + AppState.audioData.mid * 0.5;
            child.scale.x = sidePulse;
            child.scale.z = sidePulse;
            
            // 強化された色変化（時刻で色相ベース調整）
            const timeHue = timeInfluence + minuteCycle * 0.1;
            const hue = (timeHue + 0.6 + AppState.audioData.treble * 0.4 + index * 0.05) % 1;
            const brightness = (0.3 + AppState.audioData.mid * 1.0) * (0.7 + timeInfluence * 0.3);
            child.material.color.setHSL(hue, 1, brightness);
            
            // 強化された透明度（時刻で基本透明度調整）
            child.material.opacity = (0.6 + AppState.audioData.volume * 0.8) * (0.8 + timeInfluence * 0.2);
            
            // 位置振動追加（時刻で振動パターン変化）
            const timeVibration = 1 + secondsCycle * 0.3;
            child.position.y += Math.sin(AppState.time * 5 + index * 0.5) * AppState.audioData.bass * 0.5 * timeVibration;
        });
        
        // 強化されたグループ全体の回転（時刻で回転速度調整）
        const timeRotation = 1 + timeInfluence * 0.3;
        currentVisualScene.rotation.y += (0.01 + AppState.audioData.treble * 0.08) * timeRotation;
        currentVisualScene.rotation.x += (AppState.audioData.bass * 0.02) * (1 + minuteCycle * 0.2);
    }
}

// シーン6更新（強化されたエナジー・オーブ・時刻連動版）
function updateScene6() {
    if (currentVisualScene && currentVisualScene.children) {
        // 時刻による影響
        const timeInfluence = AppState.currentTime.timeOfDay;
        const hourCycle = Math.cos(AppState.currentTime.hours * Math.PI / 12);
        const minuteCycle = Math.sin(AppState.currentTime.minutes * Math.PI / 30);
        
        currentVisualScene.children.forEach((child, index) => {
            // 強化された軌道回転（時刻で軌道速度調整）
            const timeSpeed = 1 + timeInfluence * 0.5;
            const speed = (0.02 + AppState.audioData.bass * 0.15) * timeSpeed;
            const angle = AppState.time * speed + index * Math.PI / 4;
            const radius = (3 + AppState.audioData.mid * 4) * (0.8 + timeInfluence * 0.4);
            
            child.position.x = Math.cos(angle) * radius;
            child.position.z = Math.sin(angle) * radius;
            child.position.y = Math.sin(AppState.time * 2 + index) * 3 * (0.8 + timeInfluence * 0.4) + AppState.audioData.treble * 2;
            
            // 強化されたスケール変化（時刻で基本スケール調整）
            const timeScale = 0.8 + timeInfluence * 0.4;
            const scale = timeScale + AppState.audioData.volume * 1.2;
            child.scale.setScalar(scale);
            
            // 強化された色変化（時刻で色相ベース調整）
            const timeHue = timeInfluence + hourCycle * 0.1;
            const hue = (timeHue + index / 8 + AppState.time * 0.1 + AppState.audioData.bass * 2) % 1;
            const brightness = (0.6 + AppState.audioData.volume * 0.6) * (0.7 + timeInfluence * 0.3);
            child.material.color.setHSL(hue, 1, brightness);
            
            // 回転アニメーション追加（時刻で回転速度調整）
            const timeRotSpeed = 1 + minuteCycle * 0.3;
            child.rotation.x += AppState.audioData.mid * 0.1 * timeRotSpeed;
            child.rotation.y += AppState.audioData.treble * 0.08 * timeRotSpeed;
            
            // ビート時のパルスエフェクト（時刻で強度調整）
            if (AppState.audioData.beatDetected) {
                child.material.opacity = 1.0;
            } else {
                child.material.opacity = (0.7 + AppState.audioData.volume * 0.3) * (0.8 + timeInfluence * 0.2);
            }
        });
    }
}

// シーン7更新（レーザー・ビーム・時刻連動版）
function updateScene7() {
    if (currentVisualScene && currentVisualScene.children) {
        // 時刻による影響
        const timeInfluence = AppState.currentTime.timeOfDay;
        const hourCycle = Math.sin(AppState.currentTime.hours * Math.PI / 12);
        const secondsCycle = Math.cos(AppState.currentTime.seconds * Math.PI / 30);
        
        currentVisualScene.children.forEach((child, index) => {
            // レーザー回転（時刻で回転速度調整）
            const timeRotSpeed = 1 + timeInfluence * 0.4;
            child.rotation.z = (index / 12) * Math.PI * 2 + AppState.time * 0.5 * timeRotSpeed;
            
            // 強度変化（時刻で基本強度調整）
            child.material.opacity = (0.3 + AppState.audioData.bass * 0.7) * (0.8 + timeInfluence * 0.2);
            
            // 色変化（時刻で色相ベース調整）
            const timeHue = timeInfluence + hourCycle * 0.1;
            const hue = (timeHue + index / 12 + AppState.time * 0.1) % 1;
            child.material.color.setHSL(hue, 1, 0.8 * (0.7 + timeInfluence * 0.3));
        });
        
        // グループ全体の回転（時刻で回転速度調整）
        const globalRotSpeed = 1 + secondsCycle * 0.3;
        currentVisualScene.rotation.y += AppState.audioData.treble * 0.1 * globalRotSpeed;
    }
}

// シーン8更新（プラズマ・フィールド・時刻連動版）
function updateScene8() {
    if (currentVisualScene && currentVisualScene.material) {
        // 時刻による影響
        const timeInfluence = AppState.currentTime.timeOfDay;
        const hourCycle = Math.cos(AppState.currentTime.hours * Math.PI / 12);
        const minuteCycle = Math.sin(AppState.currentTime.minutes * Math.PI / 30);
        
        // スケール変化（時刻でプラズマ強度調整）
        const plasmaIntensity = 0.8 + timeInfluence * 0.4;
        const scale = plasmaIntensity + AppState.audioData.bass * 2;
        currentVisualScene.scale.setScalar(scale);
        
        // 色変化（時刻で色相ベース調整）
        const timeHue = timeInfluence * 0.2 + hourCycle * 0.1;
        const hue = (timeHue + AppState.time * 0.1) % 1;
        currentVisualScene.material.color.setHSL(hue, 1, 0.5 * (0.7 + timeInfluence * 0.3));
        
        // 透明度（時刻で基本透明度調整）
        currentVisualScene.material.opacity = (0.2 + AppState.audioData.volume * 0.6) * (0.8 + timeInfluence * 0.2);
        
        // 回転（時刻で回転速度調整）
        const timeRotSpeed = 1 + minuteCycle * 0.3;
        currentVisualScene.rotation.x += (0.01 + AppState.audioData.mid * 0.05) * timeRotSpeed;
        currentVisualScene.rotation.y += (0.02 + AppState.audioData.treble * 0.03) * timeRotSpeed;
    }
}

// シーン9更新（ストロボ・カオス）
function updateScene9() {
    if (currentVisualScene && currentVisualScene.children) {
        const strobe = AppState.audioData.beatDetected;
        
        currentVisualScene.children.forEach((child, index) => {
            // 時刻による影響
            const timeInfluence = AppState.currentTime.timeOfDay;
            const secondsCycle = Math.sin(AppState.currentTime.seconds * Math.PI / 15);
            
            // ストロボ効果（時刻でストロボ強度調整）
            const strobeIntensity = 0.7 + timeInfluence * 0.6;
            const strobeThreshold = strobe ? (0.3 * strobeIntensity) : (0.7 * strobeIntensity);
            child.visible = Math.random() > strobeThreshold;
            
            // ランダム色変化（時刻で色相ベース調整）
            if (strobe) {
                const timeHue = timeInfluence * 0.3;
                const randomColor = Math.random() * 0xffffff;
                child.material.color.setHex(randomColor);
                // 時刻で色調補正
                child.material.color.offsetHSL(timeHue, 0, 0);
            }
            
            // ランダム位置変化（時刻でカオス強度調整）
            const chaosFreq = 0.05 * (0.8 + timeInfluence * 0.4) * (1 + secondsCycle * 0.5);
            if (Math.random() > (0.95 - chaosFreq)) {
                const chaosRange = 15 * (0.8 + timeInfluence * 0.4);
                child.position.set(
                    (Math.random() - 0.5) * chaosRange,
                    (Math.random() - 0.5) * chaosRange,
                    (Math.random() - 0.5) * chaosRange
                );
            }
        });
    }
}

// シーン10更新（ハイパー・トンネル）
function updateScene10() {
    if (currentVisualScene && currentVisualScene.children) {
        currentVisualScene.children.forEach((child, index) => {
            // 時刻による影響
            const timeInfluence = AppState.currentTime.timeOfDay;
            const minuteCycle = Math.cos(AppState.currentTime.minutes * Math.PI / 30);
            const secondsCycle = Math.sin(AppState.currentTime.seconds * Math.PI / 30);
            
            // トンネル前進（時刻で速度調整）
            const tunnelSpeed = (1 + timeInfluence * 0.5) * (1 + secondsCycle * 0.3);
            child.position.z += (0.1 + AppState.audioData.bass * 0.2) * tunnelSpeed;
            
            // リセット（時刻でトンネル長さ調整）
            const tunnelLength = 40 * (0.8 + timeInfluence * 0.4);
            if (child.position.z > 10) {
                child.position.z = -tunnelLength;
            }
            
            // 色変化（時刻で色相ベース調整）
            const timeHue = timeInfluence + minuteCycle * 0.1;
            const hue = (timeHue + index / 20 + AppState.time * 0.05) % 1;
            child.material.color.setHSL(hue, 1, 0.5 * (0.7 + timeInfluence * 0.3));
            
            // 透明度変化（時刻で基本透明度調整）
            child.material.opacity = (0.4 + AppState.audioData.mid * 0.6) * (0.8 + timeInfluence * 0.2);
        });
    }
}

// シーン11更新（Lightning Storm - 時刻連動版）
function updateScene11() {
    if (currentVisualScene && currentVisualScene.children) {
        // 時刻による影響
        const timeInfluence = AppState.currentTime.timeOfDay;
        const hourCycle = Math.sin(AppState.currentTime.hours * Math.PI / 12);
        const minuteCycle = Math.cos(AppState.currentTime.minutes * Math.PI / 30);
        const secondsCycle = Math.sin(AppState.currentTime.seconds * Math.PI / 15); // 15秒周期
        
        currentVisualScene.children.forEach((child, index) => {
            if (child.userData.type === 'lightning') {
                // 稲妻の動的変化（時刻で嵐の強度調整）
                const userData = child.userData;
                const stormIntensity = 0.7 + timeInfluence * 0.6; // 時刻で嵐の強度
                const bassIntensity = AppState.audioData.bass * userData.intensity * stormIntensity;
                
                // 透明度の変化（稲妻の明滅・時刻で頻度調整）
                const timeFlickerSpeed = 15 + secondsCycle * 10; // 時刻で明滅速度変化
                const flicker = Math.sin(AppState.time * timeFlickerSpeed + userData.phase) * 0.3 + 0.7;
                child.material.opacity = flicker * (0.5 + bassIntensity);
                
                // 色相変化（電気的な青〜紫・時刻で色調変化）
                const timeHueShift = timeInfluence * 0.1 + hourCycle * 0.05;
                const hue = 0.6 + timeHueShift + Math.sin(AppState.time * 2 + userData.phase) * 0.1 + AppState.audioData.treble * 0.2;
                child.material.color.setHSL(hue, 1, (0.8 + bassIntensity * 0.2) * stormIntensity);
                
                // ビート時の強烈なフラッシュ
                if (AppState.audioData.beatDetected) {
                    child.material.opacity = 1.0;
                    child.material.color.setRGB(1, 1, 1);
                }
            }
            else if (child.userData.type === 'orb') {
                // エネルギーオーブの動的変化（時刻で活動レベル調整）
                const userData = child.userData;
                const timeActivity = 0.8 + timeInfluence * 0.4;
                const bassImpact = AppState.audioData.bass * 2 * timeActivity;
                const midImpact = AppState.audioData.mid * 1.5 * timeActivity;
                
                // 動的スケール（時刻で基本サイズ調整）
                const timeScale = 0.8 + timeInfluence * 0.4;
                const scale = timeScale + bassImpact * 0.8 + Math.sin(AppState.time * 3 + userData.phase) * 0.3;
                child.scale.setScalar(scale);
                
                // 位置の振動（時刻で振動パターン変化）
                const timeVibration = 1 + minuteCycle * 0.3;
                const offset = new THREE.Vector3(
                    Math.sin(AppState.time * 2 + userData.phase) * midImpact * timeVibration,
                    Math.cos(AppState.time * 1.5 + userData.phase) * midImpact * timeVibration,
                    Math.sin(AppState.time * 2.5 + userData.phase) * midImpact * timeVibration
                );
                child.position.copy(userData.originalPosition).add(offset);
                
                // 色相変化（時刻で色調変化）
                const timeHue = timeInfluence * 0.1 + hourCycle * 0.05;
                const hue = 0.65 + timeHue + Math.sin(AppState.time * 1.5 + userData.phase) * 0.1 + AppState.audioData.treble * 0.3;
                child.material.color.setHSL(hue, 1, (0.8 + bassImpact * 0.2) * timeActivity);
                
                // 透明度（時刻で基本透明度調整）
                child.material.opacity = (0.7 + AppState.audioData.volume * 0.3) * (0.8 + timeInfluence * 0.2);
                
                // 回転（時刻で回転速度調整）
                const timeRotSpeed = 1 + timeInfluence * 0.3;
                child.rotation.x += (0.02 + AppState.audioData.mid * 0.05) * timeRotSpeed;
                child.rotation.y += (0.03 + AppState.audioData.treble * 0.04) * timeRotSpeed;
            }
            else if (child.userData.type === 'clouds') {
                // 雲パーティクルの動的変化（時刻で雲の密度調整）
                const cloudDensity = 0.7 + timeInfluence * 0.6;
                child.material.size = (5 + AppState.audioData.volume * 3) * cloudDensity;
                child.material.opacity = (0.3 + AppState.audioData.mid * 0.3) * cloudDensity;
                
                // 雲の回転（時刻で風の強さ調整）
                const windStrength = 1 + hourCycle * 0.3;
                child.rotation.y += (0.005 + AppState.audioData.bass * 0.02) * windStrength;
                child.rotation.z += (0.003 + AppState.audioData.treble * 0.01) * windStrength;
            }
        });
        
        // 全体的な動的効果（時刻で嵐の回転調整）
        const stormRotation = 1 + timeInfluence * 0.4;
        currentVisualScene.rotation.y += (0.002 + AppState.audioData.bass * 0.01) * stormRotation;
        
        // ビート時の全体フラッシュ効果（時刻で雷の色調整）
        if (AppState.audioData.beatDetected && AppState.audioData.bass > 0.6) {
            if (threeScene.background) {
                // 時刻で雷の色調整
                const lightningColor = timeInfluence < 0.5 ? 0x2a2a4a : 0x4a4a2a;
                threeScene.background.setHex(lightningColor);
                setTimeout(() => {
                    if (threeScene.background) {
                        threeScene.background.setHex(0x0a0a20);
                    }
                }, 100);
            }
        }
    }
}

// シーン12更新（サイケデリック・マトリックス・時刻連動版）
function updateScene12() {
    if (currentVisualScene && currentVisualScene.children) {
        // 時刻による影響
        const timeInfluence = AppState.currentTime.timeOfDay;
        const hourCycle = Math.sin(AppState.currentTime.hours * Math.PI / 12);
        const minuteCycle = Math.cos(AppState.currentTime.minutes * Math.PI / 30);
        
        currentVisualScene.children.forEach((child, index) => {
            // 落下効果（時刻で落下速度調整）
            const timeFallSpeed = 0.8 + timeInfluence * 0.4;
            child.position.y -= (0.05 + AppState.audioData.bass * 0.1) * timeFallSpeed;
            
            // リセット（時刻で高さ範囲調整）
            const resetHeight = 15 * (0.8 + timeInfluence * 0.4);
            if (child.position.y < -10) {
                child.position.y = resetHeight;
            }
            
            // 色変化（時刻で色相ベース調整）
            const timeHueBase = timeInfluence * 0.2 + hourCycle * 0.1;
            const hue = timeHueBase + 0.3 + Math.sin(AppState.time * 0.5 + index * 0.1) * 0.2;
            const saturation = 0.8 + timeInfluence * 0.2;
            const lightness = (0.5) * (0.7 + minuteCycle * 0.3);
            child.material.color.setHSL(hue, saturation, lightness);
            
            // 透明度（時刻で基本透明度調整）
            child.material.opacity = (0.5 + AppState.audioData.mid * 0.5) * (0.7 + timeInfluence * 0.3);
        });
    }
}

// ページロード時に初期化実行
window.addEventListener('load', init);