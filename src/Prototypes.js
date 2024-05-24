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
        this.getSplatCenter(splatIndex, startingPoint.center, false)
        this.getSplatColor(splatIndex, startingPoint.color)

        //TODO if you have more then one group you can back check and try again with a subgroup and see if they can be merged with more "group data"
        const group = {
            points:[startingPoint],
            centerSum:new THREE.Vector3(),
            center:new THREE.Vector3(),
            nearestDistSum:0,
            averageNearestDist:100,
        };

        function updateGroupInfo(group, point, dists) {
            group.centerSum.add(point.center);
            group.center = group.centerSum.clone();
            group.center.divideScalar(group.points.length);
            //TODO find a fast way to do the average nearest dist. see if its even needed.
            //this seems to be done in position model so you can jsut do it there to optimize rather then doing it two times
            // group.averageNearestDist = ALLOWED_GAP;
            //THIS CAN BE OPTIMIZED I JUST CANT THIN K HOW RIGHT NOW> IM CONFIDENT YOU CAN SKIP A FOR LOOP
            group.nearestDistSum += dists[0] * 2;
            group.averageNearestDist = group.nearestDistSum / group.points.length;
        }

        const colorModel = (color4) => {
            const dist = Math.sqrt(Math.pow(startingPoint.color.x - color4.x, 2) + Math.pow(startingPoint.color.y - color4.y, 2) + Math.pow(startingPoint.color.z - color4.z, 2))

            if (dist <= 10) {
                return 1;
            } else {
                return 0;
            }
        }

        const positionModel = (point, dists=[]) => {
            group.points.forEach((p)=>{
                dists.push(point.distanceTo(p.center))
            })

            dists.sort();

            const minDist = dists[0];
            const distToCenter = group.center.distanceTo(point);

            console.log(group.averageNearestDist);
            if (minDist <= group.averageNearestDist) {
                return 1;
            } else {
                return 0;
            }
        }

        const inGroupModel = (colorPrediction, positionPrediction)=>{
            if (colorPrediction + positionPrediction >= 1) {
                return 1;
            } else {
                return 0;
            }
        }

        const acceptPoint = (point)=>{
            // const node = this.getOctreeNodeByPoint(point.center)
            const dists = []
            const isGood = !!inGroupModel(
                colorModel(point.color),
                positionModel(point.center, dists),
            )

            if (isGood) {
                group.points.push(point);
                updateGroupInfo(group, point, dists);
            }

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

    return group.points;
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