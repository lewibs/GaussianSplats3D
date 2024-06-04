import { SplatBuffer } from "./loaders/SplatBuffer";
import { SplatMesh } from "./SplatMesh";
import { rgbaArrayToInteger } from "./Util";
import * as THREE from "three";
import { SplatTree } from "./splattree/SplatTree";
import BlobTree from "./BlobTree";
import DBSCAN from "./DBSCAN";
import OPTICS from "./OPTICS";
import KMEANS from "./KMEANS";

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
    [255,215,0],  // Gold
    [220,20,60],  // Crimson
    [60,179,113], // Medium Sea Green
    [138,43,226], // Blue Violet
    [255,99,71],  // Tomato
    [154,205,50], // Yellow Green
    [218,112,214],// Orchid
    [139,69,19],  // Saddle Brown
    [233,150,122],// Dark Salmon
    [144,238,144],// Light Green
    [70,130,180], // Steel Blue
    [255,140,0],  // Dark Orange
    [186,85,211], // Medium Orchid
    [127,255,0],  // Chartreuse
    [205,92,92],  // Indian Red
    [64,224,208], // Turquoise
    [210,105,30], // Chocolate
    [148,0,211],  // Dark Violet
    [255,20,147], // Deep Pink
    [85,107,47],  // Dark Olive Green
    [255,228,181],// Moccasin
    [100,149,237],// Cornflower Blue
    [255,69,0],   // Red Orange
    [255,222,173],// Navajo White
    [199,21,133], // Medium Violet Red
    [72,61,139],  // Dark Slate Blue
    [199,21,133], // Medium Violet Red
    [75,0,130],   // Indigo
    [107,142,35], // Olive Drab
    [255,250,205],// Lemon Chiffon
    [0,206,209],  // Dark Turquoise
    [95,158,160], // Cadet Blue
    [176,224,230],// Powder Blue
    [0,191,255],  // Deep Sky Blue
    [123,104,238],// Medium Slate Blue
    [255,160,122],// Light Salmon
    [240,128,128],// Light Coral
    [210,180,140],// Tan
    [255,105,180],// Hot Pink
    [147,112,219],// Medium Purple
    [128,0,0],    // Dark Red
    [173,255,47], // Green Yellow
    [85,107,47],  // Dark Olive Green
    [244,164,96], // Sandy Brown
    [127,255,212],// Aquamarine
    [32,178,170], // Light Sea Green
    [160,82,45],  // Sienna
    [143,188,143],// Dark Sea Green
    [255,69,0],   // Red Orange
    [219,112,147],// Pale Violet Red
    [255,20,147], // Deep Pink
    [238,130,238],// Violet
    [139,0,139],  // Dark Magenta
    [255,218,185],// Peach Puff
    [0,250,154],  // Medium Spring Green
    [72,61,139]   // Dark Slate Blue
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

SplatMesh.prototype.DBSCAN = function(points, range, neighbors) {
    // {
    //     node_id: node.id,
    //     indexes: idxs,
    //     color: mean_color.clone(),
    //     center: mean_center.clone(),
    // }

    let minx = Number.MAX_SAFE_INTEGER;
    let miny = Number.MAX_SAFE_INTEGER;
    let minz = Number.MAX_SAFE_INTEGER;
    let maxx = Number.MIN_SAFE_INTEGER;
    let maxy = Number.MIN_SAFE_INTEGER;
    let maxz = Number.MIN_SAFE_INTEGER;

    for (let i = 0; i < points.length; i++) {
        if (points[i].center.x > maxx) {
            maxx = points[i].center.x;
        }
        if (points[i].center.x < minx) {
            minx = points[i].center.x;
        }
        if (points[i].center.y > maxy) {
            maxy = points[i].center.y;
        }
        if (points[i].center.y < miny) {
            miny = points[i].center.y;
        }
        if (points[i].center.z > maxz) {
            maxz = points[i].center.z;
        }
        if (points[i].center.z < minz) {
            minz = points[i].center.z;
        }
    }

    for (let i = 0; i < points.length; i++) {
        points[i].center.x = (points[i].center.x-minx)/(maxx-minx);
        points[i].center.y = (points[i].center.y-miny)/(maxy-miny);
        points[i].center.z = (points[i].center.z-minz)/(maxz-minz);
        points[i].color.x = points[i].color.x / 255;
        points[i].color.y = points[i].color.y / 255;
        points[i].color.z = points[i].color.z / 255;
        points[i].color.w = points[i].color.w / 255;
    }

    const map = [];
    const dataset = [];

    for (let i = 0; i < points.length; i++) {
        map.push(points[i].node_id);
        dataset.push([points[i].center.x, points[i].center.y, points[i].center.z, points[i].color.x, points[i].color.y, points[i].color.z, points[i].color.w])
    }

    const dbscan = new DBSCAN();
    const clusters = dbscan.run(dataset, range, neighbors);


    for (let i = 0; i < clusters.length; i++) {
        const global_ids = [];
        let point = new THREE.Vector4();

        for (let j = 0; j < clusters[i].length; j++) {
            point = points[clusters[i][j]];
            global_ids.push(...point.indexes);
        }

        this.updateGPUSplatColors(global_ids, ...colors[i], 255);
    }

    return clusters;
}

SplatMesh.prototype.visualizeClusters = function(points, clusters) {
    clusters.forEach((cluster, i)=>{
        const vertices = [];
        cluster.forEach((i)=>{
            vertices.push( points[i].color.x, points[i].color.y, points[i].color.z );
        })
      
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
        const material = new THREE.PointsMaterial( );
        material.color.set(colors[i][0] / 255, colors[i][1] / 255, colors[i][2] / 255);
        const points_obj = new THREE.Points( geometry, material );
        this.add(points_obj)
      })
}

SplatMesh.prototype.downsample = function() {
    const tree = this.getSplatTree()
    const points = [];

    tree.visitLeaves((node)=>{
        const idxs = node.data.indexes;

        const center = new THREE.Vector3();
        const color = new THREE.Vector4();
        const mean_center = new THREE.Vector3();
        const mean_color = new THREE.Vector4();

        for (let i of idxs) {
            this.getSplatCenter(i, center, false);
            this.getSplatColor(i, color);
            mean_center.add(center);
            mean_color.add(color);
        }

        mean_center.divideScalar(idxs.length);
        mean_color.divideScalar(idxs.length);

        points.push({
            node_id: node.id,
            indexes: idxs,
            color: mean_color.clone(),
            center: mean_center.clone(),
        })
    })

    // tree.visitLeaves((node)=>{
    //     const idxs = node.data.indexes;
        
    //     const center = new THREE.Vector3();
    //     const color = new THREE.Vector4();
        
    //     const id_map = [];
    //     const dataset = [];
    //     const color_dataset = [];
    //     const center_dataset = [];
        
    //     for (let i of idxs) {
    //         this.getSplatCenter(i, center, false)
    //         this.getSplatColor(i, color)
    //         id_map.push(i);
    //         dataset.push([...color.toArray()]);
    //         color_dataset.push([...color.toArray()]);
    //         center_dataset.push([...center.toArray()]);
    //     }
        
    //     let dbscan = new DBSCAN();
    //     let clusters = dbscan.run(dataset, 50, 4);

    //     for (let i = 0; i < clusters.length; i++) {
    //         const mean_center = new THREE.Vector3();
    //         const mean_color = new THREE.Vector4();
    //         for (let j = 0; j < clusters[i].length; j++) {
    //             center.fromArray(center_dataset[clusters[i][j]]);
    //             color.fromArray(color_dataset[clusters[i][j]]);
    //             mean_color.add(color);
    //             mean_center.add(center);
    //         }
    //         mean_center.divideScalar(clusters[i].length);
    //         mean_color.divideScalar(clusters[i].length);
            
    //         points.push({
    //             node_id: node.id,
    //             indexes: clusters[i].map((i)=>id_map[i]),
    //             color: mean_color.clone(),
    //             center: mean_center.clone(),
    //         })
    //     }
    // })

    return points;
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

        const idxs = node.data.indexes
        const center = new THREE.Vector3();
        node.boundingBox.getCenter(center);
    
        const xSpan = Math.abs(node.boundingBox.max.x - node.boundingBox.min.x) / 2;
        const ySpan = Math.abs(node.boundingBox.max.y - node.boundingBox.min.y) / 2;
        const zSpan = Math.abs(node.boundingBox.max.z - node.boundingBox.min.z) / 2;

        const needsExploration = {px:false, nx:false, ny:false, py:false, nz:false, pz:false};

        const mean_color = new THREE.Vector4();
        const mean_center = new THREE.Vector3();
        let accepted = 0;

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
                accepted++;
                mean_color.add(point.color);
                mean_center.add(point.center);
                [needsExploration.px, needsExploration.nx] = needsExplorationCheck(center.x, point.center.x, xSpan);
                [needsExploration.py, needsExploration.ny] = needsExplorationCheck(center.y, point.center.y, ySpan);
                [needsExploration.pz, needsExploration.nz] = needsExplorationCheck(center.z, point.center.z, zSpan);
            }
        }

        mean_color.divideScalar(accepted);
        mean_color.divideScalar(255);
        mean_center.divideScalar(accepted);
        
        if (window.showBox) {
            this.add(new THREE.Box3Helper(node.boundingBox));
        }

        if (window.showMeanVoxel) {
            //TODO scale by length?
            const geometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);
            const material = new THREE.MeshBasicMaterial();
            material.color.set(...mean_color.toArray())
            const obj = new THREE.Mesh(geometry, material);
            obj.position.set(mean_center.x, mean_center.y, mean_center.z);
            this.add(obj);
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