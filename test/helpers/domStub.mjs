// Minimal no-op DOM/Canvas stand-ins so Map.js/UI.js can be imported and run
// under plain Node — only the shapes they touch need to exist.

class FakeCanvasRenderingContext2D {
  translate() {}
  rotate() {}
  scale() {}
  drawImage() {}
  resetTransform() {}
  clip() {}
}

class FakeCanvas {
  constructor() {
    this.width = 0;
    this.height = 0;
  }
  getContext() {
    return new FakeCanvasRenderingContext2D();
  }
}

class FakeImage {
  constructor() {
    this.width = 100;
    this.height = 100;
  }
  set src(_value) {}
}

class FakePath2D {
  rect() {}
}

/** Installs the global stubs Map.js/UI.js need, once per process. */
export function installDomStub() {
  if (globalThis.document?.__hexEmpireStub) return;

  globalThis.document = {
    __hexEmpireStub: true,
    getElementById: () => null,
    createElement: (tagName) => {
      if (tagName === 'canvas') return new FakeCanvas();
      return {};
    },
  };
  globalThis.Image = FakeImage;
  globalThis.Path2D = FakePath2D;
}

/** Builds a fake `images` map matching the shape Map.js/Game.js expect (key -> { img }). */
export function buildFakeImages() {
  const images = {};
  for (const prefix of ['grassBg', 'seaBg', 'townBgGrass']) {
    for (let i = 1; i <= 6; i++) {
      images[`${prefix}${i}`] = { img: new FakeImage() };
    }
  }
  images.city = { img: new FakeImage() };
  images.port = { img: new FakeImage() };
  for (let i = 0; i < 4; i++) {
    images[`capital${i}`] = { img: new FakeImage() };
  }
  return images;
}
