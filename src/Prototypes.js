import { SplatBuffer } from "./loaders/SplatBuffer";
import { SplatMesh } from "./SplatMesh";
import { rgbaArrayToInteger } from "./Util";
import * as THREE from "three";
import { SplatTree } from "./splattree/SplatTree";
import BlobTree from "./BlobTree";
import DBSCAN from "./DBSCAN";
import OPTICS from "./OPTICS";

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

SplatMesh.prototype.knnOctree = function (splatIndex) {
    const EXPLORED_NODES = {};
    const ALLOWED_GAP = 0; //TODO just block expansion for now
    
    class PointDto {
        id;
        color=new THREE.Vector3();
        center = new THREE.Vector3();
    }

    //used to check if need to explore outside of node
    const needsExplorationCheck = (centerCoord, pointCoord, boxRadius) => {
        const dist = Math.abs(centerCoord - pointCoord);
        if (Math.abs(dist - boxRadius) < ALLOWED_GAP) {
            if (centerCoord < pointCoord) {
                return [false, true];
            } else {
                return [true, false];
            }
        } else {
            return [false, false];
        }
    };
    
    const [acceptPoint, group] = ((splatIndex) => {
        const startingPoint = new PointDto();
        startingPoint.id = splatIndex
        startingPoint.center = new THREE.Vector3();
        startingPoint.color = new THREE.Vector4();
        startingPoint.accepted = true;
        this.getSplatCenter(splatIndex, startingPoint.center, false)
        this.getSplatColor(splatIndex, startingPoint.color)

        //TODO if you have more then one group you can back check and try again with a subgroup and see if they can be merged with more "group data"
        const group = {
            accepted:[startingPoint],
            rejected:[],
            all: [startingPoint],
        };

        const acceptPoint = (point)=>{
            // const node = this.getOctreeNodeByPoint(point.center)
            let isGood = true;
            let dist = 0;
            const minDist = Number.MAX_SAFE_INTEGER; 
            const blobCenter = new THREE.Vector3();
            const blobColor = new THREE.Vector4();
            
            for (let i = 0; i < group.accepted; i++) {
                dist = group.accepted[i].center.distanceTo(minDist)
                blobCenter.add(group.accepted[i].center)
                blobColor.add(group.accepted[i].color)

                if (dist < minDist) {
                    minDist = dist;
                }
            }

            blobCenter.divideScalar(group.accepted.length)
            blobColor.divideScalar(group.accepted.length)

            //TODO decide if it is good here...

            if (isGood) {
                point.accepted = true;
                group.accepted.push(point);
            } else {
                point.accepted = false;
                group.rejected.push(point);
            }
            group.all.push(point);

            return isGood;
        }

        return [acceptPoint, group];
    })(splatIndex)

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

        const DBSCAN_DATA = [];
        const INDEXES = [];

        for (let i of idxs) {
            INDEXES.push(i);
            const point = new PointDto();
            point.id = i
            point.center = new THREE.Vector3();
            point.color = new THREE.Vector4();
            this.getSplatCenter(i, point.center, false)
            this.getSplatColor(i, point.color)
            DBSCAN_DATA.push([point.color.x, point.color.y, point.color.z]);
            //DBSCAN_DATA.push([point.center.x, point.center.y, point.center.z]);

            //DO NOT DELETE THIS IS USED TO EXPORE MOR ENODES
            // if (acceptPoint(point)) {
            //     [needsExploration.px, needsExploration.nx] = needsExplorationCheck(center.x, point.center.x, xSpan);
            //     [needsExploration.py, needsExploration.ny] = needsExplorationCheck(center.y, point.center.y, ySpan);
            //     [needsExploration.pz, needsExploration.nz] = needsExplorationCheck(center.z, point.center.z, zSpan);
            // }

        }

        console.log(DBSCAN_DATA);

        const dbscan = new DBSCAN();
        const clusters = dbscan.run(DBSCAN_DATA, 5, 1);
        const noise = dbscan.noise;

        for (let i = 0; i < noise.length; i++) {
            noise[i] = INDEXES[noise[i]];
        }
        this.updateGPUSplatColors(noise, 0,0,0,255);

        const colors = [
            [255,0,0],    // Red
            [0,255,0],    // Green
            [0,0,255],    // Blue
            [255,255,0],  // Yellow
            [0,255,255],  // Cyan
            [255,0,255],  // Magenta
            [255,255,255],// White
            [128,0,0],    // Maroon
            [128,128,0],  // Olive
            [0,128,0],    // Dark Green
            [128,0,128],  // Purple
            [0,128,128],  // Teal
            [0,0,128],    // Navy
            [192,192,192],// Silver
            [128,128,128],// Gray
            [255,165,0],  // Orange
            [255,192,203],// Pink
            [75,0,130],   // Indigo
            [240,230,140],// Khaki
            [173,216,230],// Light Blue
            [250,128,114],// Salmon
            [244,164,96], // Sandy Brown
            [32,178,170], // Light Sea Green
            [255,215,0]   // Gold
        ];
        console.log(clusters);
        clusters.forEach((cluster, i)=>{
            for (let i = 0; i < cluster.length; i++) {
                cluster[i] = INDEXES[cluster[i]];
            }
            this.updateGPUSplatColors(cluster, ...colors[i], 255);
        })
        

        const adjacent = this.getSplatTree().getNodesAdjacent(node, {px:!needsExploration.px, nx:!needsExploration.nx, py:!needsExploration.py, ny:!needsExploration.ny, pz:!needsExploration.pz, nz:!needsExploration.nz})

        adjacent.forEach((node)=>{
            knnExplore(node);
        })

    }

    const node = this.getOctreeNodeFromIndex(splatIndex); 
    knnExplore(node);

    return group.accepted;
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