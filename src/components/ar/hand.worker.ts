import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

let detector: HandLandmarker | undefined;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      const files = await FilesetResolver.forVisionTasks(`${data.base}/mediapipe/wasm`, true);
      detector = await HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: `${data.base}/mediapipe/hand_landmarker.task`, delegate: 'CPU' },
        runningMode: 'VIDEO', numHands: 1,
        minHandDetectionConfidence: .65, minHandPresenceConfidence: .65, minTrackingConfidence: .6,
      });
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'frame') {
      try {
        const result = detector!.detectForVideo(data.bitmap, data.timestamp);
        self.postMessage({ type: 'hand', landmarks: result.landmarks[0], handedness: result.handedness[0]?.[0] });
      } finally { data.bitmap.close(); }
    }
  } catch (reason) {
    self.postMessage({ type: 'error', message: reason instanceof Error ? reason.message : 'Hand tracking could not start.' });
  }
};
