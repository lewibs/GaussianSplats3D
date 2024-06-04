import * as THREE from "three"; 

function voxelizeSplat(voxelSize, gridSize, splatMesh) {
    const grid = [];
    for (let x = 0; x < gridSize; x++) {
        grid[x] = [];
        for (let y = 0; y < gridSize; y++) {
            grid[x][y] = [];
            for (let z = 0; z < gridSize; z++) {
                grid[x][y][z] = false;
            }
        }
    }

    let point = new THREE.Vector3();
    let xIndex = null;
    let yIndex = null;
    let zIndex = null;
    let index = null;
    for (let i = 0; i < splatMesh.globalSplatIndexToLocalSplatIndexMap.length; i++) {
        index = splatMesh.globalSplatIndexToLocalSplatIndexMap[i];
        splatMesh.getSplatCenter(index, point, false);
        xIndex = Math.floor(point.x / voxelSize);
        yIndex = Math.floor(point.y / voxelSize);
        zIndex = Math.floor(point.z / voxelSize);

        if (xIndex >= 0 && xIndex < gridSize &&
            yIndex >= 0 && yIndex < gridSize &&
            zIndex >= 0 && zIndex < gridSize
        ) {
            grid[xIndex][yIndex][zIndex] = true;
        }
    }

    return grid;
}

function visualizeVoxelGrid(grid, voxelSize, gridSize, scene) {
    const geometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });

    for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
            for (let z = 0; z < gridSize; z++) {
                if (grid[x][y][z]) {
                    const cube = new THREE.Mesh(geometry, material);
                    cube.position.set(x * voxelSize, y * voxelSize, z * voxelSize);
                    scene.add(cube);
                }
            }
        }
    }
}

window.voxelizeSplat = voxelizeSplat;
window.visualizeVoxelGrid = visualizeVoxelGrid;