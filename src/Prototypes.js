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

        const antiPoint = new PointDto();
        antiPoint.id = Number.MIN_SAFE_INTEGER;
        antiPoint.color = new THREE.Vector3(
            255 - startingPoint.color.x,
            255 - startingPoint.color.y,
            255 - startingPoint.color.z
          );

        //TODO if you have more then one group you can back check and try again with a subgroup and see if they can be merged with more "group data"
        const group = {
            accepted:[startingPoint],
            rejected:[],
            all: [startingPoint],
        };

        const acceptPoint = (point)=>{
            let minDist = Number.MAX_SAFE_INTEGER;
            let meanDists = 0;
            const blobCenter = new THREE.Vector3();
            const blobColor = new THREE.Vector4();
            
            {
                let dist = 0;
                
                for (let i = 0; i < group.accepted.length; i++) {
                    dist = group.accepted[i].center.distanceTo(point.center)
                    blobCenter.add(group.accepted[i].center)
                    blobColor.add(group.accepted[i].color)

                    for (let ii = 0; ii < group.accepted; ii++) {
                        meanDists += group.accepted[i].center.distanceTo(group.accepted[ii].center);
                    }
    
                    if (dist < minDist) {
                        minDist = dist;
                    }
                }
    
                meanDists /= group.accepted.length;
                blobCenter.divideScalar(group.accepted.length);
                blobColor.divideScalar(group.accepted.length);
            }

            //TODO decide if it is good here...
            // const dbscan = new DBSCAN()
            // var accepted_clusters = dbscan.run(group.accepted.map((point)=>[point.color.x, point.color.y, point.color.z]), 5, 2)
            // accepted_clusters.sort((a,b)=>b.length - a.length);
            // const accepted_colors = accepted_clusters.map((cluster)=>{
            //     const result = cluster.reduce((ac, va)=>{
            //         ac[0] += group.accepted[va].color.x;
            //         ac[1] += group.accepted[va].color.y;
            //         ac[2] += group.accepted[va].color.z;
            //         return ac
            //     }, [0,0,0])
            //     result[0] /= accepted_clusters.length
            //     result[1] /= accepted_clusters.length
            //     result[2] /= accepted_clusters.length
            //     return result;
            // });

            // var declined_clusters = dbscan.run(group.rejected.map((point)=>[point.color.x, point.color.y, point.color.z]), 5, 2)
            // declined_clusters.sort((a,b)=>b.length - a.length);
            // const rejected_colors = declined_clusters.map((cluster)=>{
            //     const result = cluster.reduce((ac, va)=>{
            //         ac[0] += group.rejected[va].color.x;
            //         ac[1] += group.rejected[va].color.y;
            //         ac[2] += group.rejected[va].color.z;
            //         return ac
            //     }, [0,0,0])
            //     result[0] /= declined_clusters.length
            //     result[1] /= declined_clusters.length
            //     result[2] /= declined_clusters.length
            //     return result;
            // });

            // const dist_calc = (a,b)=>Math.sqrt(Math.pow(a[0]-b[0],2) + Math.pow(a[1]-b[1],2) + Math.pow(a[2]-b[2],2))
            // const accepted_color_dists = accepted_colors.map((color)=>dist_calc([point.color.x, point.color.y, point.color.z], color));
            // const rejected_color_dists = rejected_colors.map((color)=>dist_calc([point.color.x, point.color.y, point.color.z], color));
            
            // let accepted_min_idx = 0;
            // let rejected_min_idx = 0;
            // let accepted_min_val = Number.MAX_SAFE_INTEGER;
            // let rejected_min_val = Number.MAX_SAFE_INTEGER;
            // for (let i = 0; i < (accepted_color_dists.length>rejected_color_dists.length)?accepted_color_dists.length:rejected_color_dists.length;i++) {
            //     if (rejected_color_dists.length>i) {
            //         if (rejected_min_val > rejected_color_dists[i]) {
            //             rejected_min_val = rejected_color_dists[i]
            //             rejected_min_idx = i;
            //         }
            //     }

            //     if (accepted_color_dists.length>i) {
            //         if (accepted_min_val > accepted_color_dists[i]) {
            //             accepted_min_val = accepted_color_dists[i]
            //             accepted_min_idx = i;
            //         }
            //     }
            // }

            // console.log("again");
            // console.log(accepted_min_val)
            // console.log(rejected_min_val)

            const dist_calc = (a, b) => 
                Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2));

            function distanceToBlobColor(point) {
                return dist_calc(
                    [blobColor.x, blobColor.y, blobColor.z],
                    [point.color.x, point.color.y, point.color.z],
                );
            }

            function distanceToBlobCenter(point) {
                return dist_calc(
                    [blobCenter.x, blobCenter.y, blobCenter.z],
                    [point.center.x, point.center.y, point.center.z],
                );
            }

            function minimumDistance() {
                return Math.abs(minDist-meanDists);
            }

            function acceptedPoints() {
                return group.accepted.length;
            }

            function rejectedPoints() {
                return group.rejected.length;
            }

            let isGood = [
                1 * distanceToBlobColor(point),
                1 * distanceToBlobCenter(point),
                1 * minimumDistance(),
                1 * acceptedPoints(),
                -1 * rejectedPoints(),
            ]
            console.log(isGood);
            isGood = isGood.reduce((pre, cur)=>pre + cur, 0)
            console.log(isGood);
            isGood = (isGood >= 0) ? true : false
            console.log(isGood)

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

        for (let i of idxs) {
            const point = new PointDto();
            point.id = i
            point.center = new THREE.Vector3();
            point.color = new THREE.Vector4();
            this.getSplatCenter(i, point.center, false)
            this.getSplatColor(i, point.color)

            //DO NOT DELETE THIS IS USED TO EXPORE MOR ENODES
            if (acceptPoint(point)) {
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