import { SplatBuffer } from "./loaders/SplatBuffer";
import { SplatMesh } from "./SplatMesh";
import { rgbaArrayToInteger } from "./Util";
import * as THREE from "three";
import { SplatTree } from "./splattree/SplatTree";
import BlobTree from "./BlobTree";
import DBSCAN from "./DBSCAN";
import OPTICS from "./OPTICS";

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

SplatMesh.prototype.objectDetection = function (splatIndex) {
    const EXPLORED_NODES = {};
    const EXPLORATION_GAP = window.exploration_gap || 0.2;
    const DIST_FROM_START = window.dist_from_start || 0.5;
    const COLOR_DIST = window.color_dist || 80;
    const CLOSEST_POINTS = window.closest_points || 5;
    
    class PointDto {
        id;
        color=new THREE.Vector3();
        center = new THREE.Vector3();
    }

    const startingPoint = new PointDto();
    startingPoint.id = splatIndex
    startingPoint.center = new THREE.Vector3();
    startingPoint.color = new THREE.Vector4();
    startingPoint.accepted = true;
    this.getSplatCenter(splatIndex, startingPoint.center, false)
    this.getSplatColor(splatIndex, startingPoint.color)
    

    const group = {
        accepted:[startingPoint],
        rejected:[],
        all: [startingPoint],
    };

    //used to check if need to explore outside of node
    //WARNING ONLY USE POINTS THAT ARE GUARENTEED CORRECT!!! We dont want to waste time since weve already determined that this point is a good color
    const needsExplorationCheck = (centerCoord, pointCoord, boxRadius) => {
        const dist = Math.abs(centerCoord - pointCoord);
        if (Math.abs(dist - boxRadius) < EXPLORATION_GAP) {
            if (centerCoord < pointCoord) {
                return [false, true];
            } else {
                return [true, false];
            }
        } else {
            return [false, false];
        }
    };

    const dist_calc = (a, b) => {
        return Math.sqrt(a.reduce((sum, currentValue, index) => {
            return sum + Math.pow(currentValue - b[index], 2);
        }, 0));
    };

    function median(values) {
        values = [...values].sort((a, b) => a - b);
        const half = Math.floor(values.length / 2);
        return (values.length % 2
          ? values[half]
          : (values[half - 1] + values[half]) / 2
        );

    }
    
    const acceptPointFirstPass = (point)=>{
        const closest_points = [];
        for (let i = 0; i < group.accepted.length; i++) {

            if (closest_points.length < CLOSEST_POINTS) {
                closest_points.push(group.accepted[i]);
            } else {
                const dist_point = dist_calc(
                    [point.center.x, point.center.y, point.center.z],
                    [group.accepted[i].center.x, group.accepted[i].center.y, group.accepted[i].center.z],
                );
                for (let ii = 0; ii < closest_points.length; ii++) {
                    const dist_saved = dist_calc(
                        [closest_points[ii].center.x, closest_points[ii].center.y, closest_points[ii].center.z],
                        [group.accepted[i].center.x, group.accepted[i].center.y, group.accepted[i].center.z],
                    );

                    if (dist_point < dist_saved) {
                        closest_points[ii] = group.accepted[i];
                        ii = closest_points.length;
                    }
                }
            }
        }

        const blobColor = new THREE.Vector4();
        
        for (let i = 0; i < closest_points.length; i++) {
            blobColor.add(closest_points[i].color)
        }

        
        blobColor.divideScalar(closest_points.length);

        
        function distanceToBlobColor(point) {
            
            const dist = dist_calc(
                [blobColor.x, blobColor.y, blobColor.z],
                [point.color.x, point.color.y, point.color.z],
            );

            return dist < (COLOR_DIST);
        }

        function distanceToOriginCenter(point) {
            return startingPoint.center.distanceTo(point.center) < (DIST_FROM_START)
        }

        let isGood = [
            distanceToOriginCenter(point),
            distanceToBlobColor(point),
        ].every((v)=>v===true)

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

    const knnExplore = (node) => {
        if (EXPLORED_NODES[node.id]) {
            return;
        } else {
            EXPLORED_NODES[node.id] = true
        }

        this.add(new THREE.Box3Helper(node.boundingBox));

        const idxs = node.data.indexes
        const center = new THREE.Vector3();
        node.boundingBox.getCenter(center);
    
        const xSpan = Math.abs(node.boundingBox.max.x - node.boundingBox.min.x) / 2;
        const ySpan = Math.abs(node.boundingBox.max.y - node.boundingBox.min.y) / 2;
        const zSpan = Math.abs(node.boundingBox.max.z - node.boundingBox.min.z) / 2;

        const needsExploration = {px:false, nx:false, ny:false, py:false, nz:false, pz:false};

        //first pass
        for (let i of idxs) {
            const point = new PointDto();
            point.id = i
            point.center = new THREE.Vector3();
            point.color = new THREE.Vector4();
            this.getSplatCenter(i, point.center, false)
            this.getSplatColor(i, point.color)

            //DO NOT DELETE THIS IS USED TO EXPORE MOR ENODES
            if (acceptPointFirstPass(point)) {
                [needsExploration.px, needsExploration.nx] = needsExplorationCheck(center.x, point.center.x, xSpan);
                [needsExploration.py, needsExploration.ny] = needsExplorationCheck(center.y, point.center.y, ySpan);
                [needsExploration.pz, needsExploration.nz] = needsExplorationCheck(center.z, point.center.z, zSpan);
            }

        }

        const adjacent = this.getSplatTree().getNodesAdjacent(node, {px:!needsExploration.px, nx:!needsExploration.nx, py:!needsExploration.py, ny:!needsExploration.ny, pz:!needsExploration.pz, nz:!needsExploration.nz})

        adjacent.forEach((node)=>{
            knnExplore(node);
        })

    }

    const node = this.getOctreeNodeFromIndex(splatIndex); 
    knnExplore(node);
    console.log(group);
    return group;
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