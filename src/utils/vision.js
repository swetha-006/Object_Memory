const CATEGORY_RULES = {
  Car: [
    'car',
    'sports car',
    'convertible',
    'minivan',
    'limousine',
    'jeep',
    'pickup',
    'racer',
    'cab',
    'taxi',
    'vehicle',
    'automobile',
  ],
  Computer: [
    'laptop',
    'notebook',
    'desktop computer',
    'computer keyboard',
    'monitor',
    'screen',
  ],
  Phone: [
    'cellular telephone',
    'mobile phone',
    'telephone',
    'hand-held computer',
    'ipod',
  ],
  Camera: [
    'camera',
    'digital camera',
    'reflex camera',
    'lens cap',
    'polaroid camera',
  ],
  Audio: [
    'loudspeaker',
    'speaker',
    'microphone',
    'tape player',
    'amplifier',
    'headphones',
  ],
  Watch: [
    'digital watch',
    'analog clock',
    'stopwatch',
    'wrist watch',
    'chronometer',
  ],
  Furniture: [
    'chair',
    'couch',
    'sofa',
    'desk',
    'table',
    'bookcase',
    'wardrobe',
    'cabinet',
    'studio couch',
  ],
  Jewellery: [
    'necklace',
    'chain',
    'ring',
    'earring',
    'bracelet',
    'jewelry',
  ],
  Document: [
    'envelope',
    'menu',
    'book jacket',
    'notebook',
    'binder',
  ],
  Tool: [
    'hammer',
    'screwdriver',
    'wrench',
    'pliers',
    'drill',
    'saw',
  ]
};

let visionModelPromise = null;

/**
 * Lazy loads TensorFlow.js and MobileNet on demand.
 * Runs 100% locally in the browser with zero network uploads for inference.
 */
export async function detectCategoryFromImage(file) {
  if (!file) {
    return {
      category: 'Other',
      label: '',
      confidence: 0,
    };
  }

  try {
    if (!visionModelPromise) {
      visionModelPromise = (async () => {
        // Dynamic lazy import prevents bloat on initial page loads
        await import('@tensorflow/tfjs');
        const mobilenet = await import('@tensorflow-models/mobilenet');
        return mobilenet.load({
          version: 2,
          alpha: 1.0,
        });
      })();
    }

    const model = await visionModelPromise;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const predictions = await model.classify(img, 5);
    URL.revokeObjectURL(url);

    for (const p of predictions) {
      const label = p.className.toLowerCase();
      for (const [category, terms] of Object.entries(CATEGORY_RULES)) {
        if (terms.some((term) => label.includes(term))) {
          return {
            category,
            label: p.className,
            confidence: p.probability,
          };
        }
      }
    }

    return {
      category: 'Other',
      label: predictions[0]?.className || '',
      confidence: predictions[0]?.probability || 0,
    };
  } catch (err) {
    console.warn('Local image classification unavailable:', err);
    return {
      category: 'Other',
      label: '',
      confidence: 0,
    };
  }
}
