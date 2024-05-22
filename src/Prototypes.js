import { SplatBuffer } from "./loaders/SplatBuffer";
import { SplatMesh } from "./SplatMesh";
import { rgbaArrayToInteger } from "./Util";

SplatMesh.prototype.updateGPUColors = function (srcFrom, srcTo) {

    for (let i = 0; i < this.scenes.length; i++) {
        const scene = this.getScene(i);
        const splatBuffer = scene.splatBuffer;
        const splatCount = splatBuffer.splatCount;
        
        srcFrom = srcFrom || 0;
        srcTo = srcTo || splatCount - 1;
        const destFrom = srcFrom;

        for (let i = srcFrom; i <= srcTo; i++) {
            const sectionIndex = splatBuffer.globalSplatIndexToSectionMap[i];
            const section = splatBuffer.sections[sectionIndex];
            const localSplatIndex = i - section.splatCountOffset;

            const colorDestBase = (i - srcFrom + destFrom) * SplatBuffer.ColorComponentCount;
            const srcSplatColorsBase = section.bytesPerSplat * localSplatIndex +
                                    SplatBuffer.CompressionLevels[splatBuffer.compressionLevel].ColorOffsetBytes;

            const dataView = new Uint8Array(splatBuffer.bufferData, section.dataBase + srcSplatColorsBase);

            let alpha = dataView[3];
            alpha = (alpha >= scene.minimumAlpha) ? alpha : 0;

            this.material.uniforms.centersColorsTexture.value.source.data.data[colorDestBase] = rgbaArrayToInteger([dataView[0], dataView[1], dataView[2], alpha], 0) | 0xFF;
        }
    }

    this.material.uniforms.centersColorsTexture.value.needsUpdate = true;
}

SplatMesh.prototype.updateGPUSplatColors = function (global_indexes, r, g, b, a) {
    for (let i = 0; i < this.scenes.length; i++) {
        const scene = this.getScene(i);
        const splatBuffer = scene.splatBuffer;

        for (i of global_indexes) {
            const sectionIndex = splatBuffer.globalSplatIndexToSectionMap[i];
            const section = splatBuffer.sections[sectionIndex];
            const localSplatIndex = i - section.splatCountOffset;
            const colorDestBase = localSplatIndex * SplatBuffer.ColorComponentCount;

            this.material.uniforms.centersColorsTexture.value.source.data.data[colorDestBase] = rgbaArrayToInteger([r,g,b,a], 0);
        }
    }

    this.material.uniforms.centersColorsTexture.value.needsUpdate = true;
} 

SplatBuffer.prototype.getColorBufferArray = function(srcFrom, srcTo) {
    // const splatCount = this.splatCount;
    // const outColorArray = []

    // srcFrom = srcFrom || 0;
    // srcTo = srcTo || splatCount - 1;
    // const destFrom = srcFrom;

    // for (let i = srcFrom; i <= srcTo; i++) {
    //     const sectionIndex = this.globalSplatIndexToSectionMap[i];
    //     const section = this.sections[sectionIndex];
    //     const localSplatIndex = i - section.splatCountOffset;

    //     const colorDestBase = (i - srcFrom + destFrom) * SplatBuffer.ColorComponentCount;
    //     const srcSplatColorsBase = section.bytesPerSplat * localSplatIndex +
    //                                SplatBuffer.CompressionLevels[this.compressionLevel].ColorOffsetBytes;

    //     const dataView = new Uint8Array(this.bufferData, section.dataBase + srcSplatColorsBase);

    //     dataView[0] = 255;

    //     outColorArray[colorDestBase] = dataView[0];
    //     outColorArray[colorDestBase + 1] = dataView[1];
    //     outColorArray[colorDestBase + 2] = dataView[2];
    //     outColorArray[colorDestBase + 3] = dataView[3];
    // }

    // console.log(outColorArray.length)
}
