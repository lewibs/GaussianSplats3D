import { SplatBuffer } from "./loaders/SplatBuffer";
import { SplatMesh } from "./SplatMesh";
import { rgbaArrayToInteger } from "./Util";
import * as THREE from "three";
import { SplatTree } from "./splattree/SplatTree";

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

SplatMesh.prototype.knnOctree = function (splatIndex, allowedDistanceDeviation, allowedColorDeviation) {
    const EXPLORED_NODES = {}
    const points = [];
    const node = this.getOctreeNodeFromIndex(splatIndex)
    const color = new THREE.Vector4()
    const center = new THREE.Vector3()

    this.getSplatCenter(splatIndex, center, false);
    this.getSplatColor(splatIndex, color);

    const colorInRange = (color4) => {
        if (!(color.x - allowedColorDeviation <= color4.x && color4.x <= color.x + allowedColorDeviation)) {
            return false;
        }

        if (!(color.y - allowedColorDeviation <= color4.y && color4.y <= color.y + allowedColorDeviation)) {
            return false;
        }

        if (!(color.z - allowedColorDeviation <= color4.z && color4.z <= color.z + allowedColorDeviation)) {
            return false;
        }

        return true;
    }

    const knnExplore = (node) => {
        if (EXPLORED_NODES[node.id]) {
            return;
        } else {
            EXPLORED_NODES[node.id] = true
        }


        const idxs = node.data.indexes
        const center = new THREE.Vector3();
        node.boundingBox.getCenter(center);
    
        const xSpan = Math.abs(node.boundingBox.max.x - node.boundingBox.min.x) / 2;
        const ySpan = Math.abs(node.boundingBox.max.y - node.boundingBox.min.y) / 2;
        const zSpan = Math.abs(node.boundingBox.max.z - node.boundingBox.min.z) / 2;

        const needsExploration = {px:false, nx:false, ny:false, py:false, nz:false, pz:false};

        for (let i of idxs) {
            const point = {}
        
            point.id = i
            point.center = new THREE.Vector3();
            point.color = new THREE.Vector4();
        
            this.getSplatCenter(i, point.center, false)
            this.getSplatColor(i, point.color)
        
            const xDist = Math.abs(center.x - point.center.x);
            if (Math.abs(xDist - xSpan) < allowedDistanceDeviation) {
                if (center.x < point.center.x && colorInRange(point.color)) {
                    needsExploration.px = true;
                } else if (colorInRange(point.color)) {
                    needsExploration.nx = true;
                }
            }
        
            const yDist = Math.abs(center.y - point.center.y);
            if (Math.abs(yDist - ySpan) < allowedDistanceDeviation) {
                if (center.y < point.center.y && colorInRange(point.color)) {
                    needsExploration.py = true;
                } else if (colorInRange(point.color)) {
                    needsExploration.ny = true;
                }
            } 
        
            const zDist = Math.abs(center.z - point.center.z);
            if (Math.abs(zDist - zSpan) < allowedDistanceDeviation) {
                if (center.z < point.center.z && colorInRange(point.color)) {
                    needsExploration.pz = true;
                } else if (colorInRange(point.color)) {
                    needsExploration.nz = true;
                }
            }

            points.push(point);
        }

        const adjacent = this.getSplatTree().getNodesAdjacent(node, {px:!needsExploration.px, nx:!needsExploration.nx, py:!needsExploration.py, ny:!needsExploration.ny, pz:!needsExploration.pz, nz:!needsExploration.nz})

        adjacent.forEach((node)=>{
            knnExplore(node);
        })
    }


    knnExplore(node)
    // this.add(new THREE.Box3Helper(node.boundingBox, 0xFF0000));

    return points
}

SplatMesh.prototype.getOctreeNodeFromIndex = function (i) {
    const center = new THREE.Vector3();
    this.getSplatCenter(i, center, false);
    const tree = this.getSplatTree();
    return tree.getOctreeNodeByPoint(center);
}

SplatMesh.prototype.showOctree = function () {
    const tree = this.getSplatTree()

    tree.visitLeaves((node)=>{
        this.add(new THREE.Box3Helper(node.boundingBox))
    })
}

SplatTree.prototype.getOctreeNodeByPoint = function (point) {
    return this.getNodesContaining(point).pop()
}

SplatTree.prototype.getNodesContaining = function (point) {
    const nodes = [];

    const visitLeavesFromNode = (node) => {
        if (node.boundingBox.containsPoint(point)) {
            nodes.push(node);
            if (node.children.length) {
                for (let child of node.children) {
                    visitLeavesFromNode(child);
                }
            } else {   
                return;
            }
        }
    };

    for (let subTree of this.subTrees) {
        visitLeavesFromNode(subTree.rootNode);
    }

    return nodes;
}

SplatTree.prototype.getNodesAdjacent = function (rootNode, excludeSides = {px:false, nx:false, ny:false, py:false, nz:false, pz:false}) {
    const nodes = [];

    const visitLeavesFromNode = (node) => {
        //check to exlude
        if (excludeSides.px && node.boundingBox.min.x >= rootNode.boundingBox.max.x) {
            return;
        }
        if (excludeSides.nx && node.boundingBox.max.x <= rootNode.boundingBox.min.x) {
            return;
        }
        if (excludeSides.py && node.boundingBox.min.y >= rootNode.boundingBox.max.y) {
            return;
        }
        if (excludeSides.ny && node.boundingBox.max.y <= rootNode.boundingBox.min.y) {
            return;
        }
        if (excludeSides.pz && node.boundingBox.min.z >= rootNode.boundingBox.max.z) {
            return;
        }
        if (excludeSides.nz && node.boundingBox.max.z <= rootNode.boundingBox.min.z) {
            return;
        }

        if (doBoxesOverlap(rootNode.boundingBox, node.boundingBox)) {
            nodes.push(node);
            if (node.children.length) {
                for (let child of node.children) {
                    visitLeavesFromNode(child);
                }
            }
        }
    };

    for (let subTree of this.subTrees) {
        visitLeavesFromNode(subTree.rootNode);
    }

    return nodes.filter((node)=>node.children.length === 0 && node !== rootNode);

    function doBoxesOverlap (box1, box2) {
        function pointIsTouching(box, point) {
            return box.containsPoint(point)
        }
    
        function getVertices(box) {
            const min = box.min;
            const max = box.max;
    
            // Calculate the vertices
            const vertices = [
                new THREE.Vector3(min.x, min.y, min.z),
                new THREE.Vector3(min.x, min.y, max.z),
                new THREE.Vector3(min.x, max.y, min.z),
                new THREE.Vector3(min.x, max.y, max.z),
                new THREE.Vector3(max.x, min.y, min.z),
                new THREE.Vector3(max.x, min.y, max.z),
                new THREE.Vector3(max.x, max.y, min.z),
                new THREE.Vector3(max.x, max.y, max.z)
            ];
            return vertices
        }
    
        return [
            ...getVertices(box1).map((vertex)=>pointIsTouching(box2, vertex)),
            ...getVertices(box2).map((vertex)=>pointIsTouching(box1, vertex))
        ].some(value => value)
    }
}