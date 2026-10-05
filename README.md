# One photo, two 3D workflows

A transparent, in-progress comparison using one credited reading-nook photo.

- **A — direct world:** prepared, not generated. No visual A/B conclusion is claimed.
- **B — split and assemble:** a real Marble 1.1 background, two real TRELLIS.2 GLBs (chair and plant), manual placement, and procedural sound.
- The lamp preview succeeded but two GLB exports failed. The free Space later reported its daily quota exhausted.
- No FAL request, top-up, or subscription was made. The background used 1580 World Labs credits. Image-tool billing was not exposed.

The viewer supports fixed viewpoints, orbit/zoom, object visibility, horizontal dragging, reset, and opt-in sound. Dragging is not physics simulation. The collision mesh is included as an artifact, but this public viewer does not use it for physics.

## Rebuild

The root is the deployable static site. With Node.js 20+:

```sh
cd source
npm install
npm run build
```

Serve the root over HTTP. GitHub Pages uses the main branch root, with `.nojekyll`.

## Evidence and attribution

`experiment.json` records status, manual object transforms, method, and costs. The posters are captures from the real browser-rendered scene. Unseen room regions and hidden object surfaces are model inferences.

Input photo: [Phil Strahl / Unsplash](https://unsplash.com/photos/yellow-armchair-side-table-with-lamp-and-plant-R6FYseWOwHQ), under the [Unsplash License](https://unsplash.com/license).

Workflow reference: [image-blaster](https://github.com/neilsonnn/image-blaster), commit `4acb43ba126a12358f71838d1b1a05e856b10eaf`. Object provider: [official Microsoft TRELLIS.2 Space](https://huggingface.co/spaces/microsoft/TRELLIS.2).

See `THIRD-PARTY-NOTICES.txt` for library notices. Third-party assets retain their respective rights; this repository makes no blanket ownership claim over them.
