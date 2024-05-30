import * as THREE from "three";

export function RANSAC(points, THRESHOLD, MAX_ITTERATIONS) {
    function select3Points(points) {
        const idx = getRandomIntegersInRange(0, points.length, 3);
        return [points[idx[0]], points[idx[1]], points[idx[2]]];
    }

    function getRandomIntegersInRange(min, max, numIntegers) {
        const uniqueIntegers = new Set();
    
        while (uniqueIntegers.size < numIntegers) {
            const randomInt = Math.floor(Math.random() * (max - min + 1)) + min;
            uniqueIntegers.add(randomInt);
        }
    
        return Array.from(uniqueIntegers);
    }

    function calculatePlane(point1, point2, point3) {
        const a = (point2.y - point1.y) * (point3.z, point1.z) - (point2.z - point1.z) * (point3.y - point2.y);
        const b = (point2.z - point1.z) * (point3.x - point1.x) - (point2.x - point1.x) * (point3.z - point2.z);
        const c = (point2.x - point1.x) * (point3.y - point1.y) - (point2.y - point1.y) * (point3.x - point2.x);
        const d = -(a*point1.x + b*point1.y + c*point1.z);
        return createThreeJSPlaneFromEquation(a,b,c,d);
    }

    function createThreeJSPlaneFromEquation(a, b, c, d) {
        const length = Math.sqrt(a * a + b * b + c * c);
        const normal = new THREE.Vector3(a / length, b / length, c / length);
        const constant = -d / length;
        return new THREE.Plane(normal, constant);
    }

    const planes = [];

    for (let i = 0; i < MAX_ITTERATIONS; i++) {
        let counts = 0;
        const plane = calculatePlane(...select3Points(points))
        for (let ii = 0; ii < points.length; ii++) {
            const dist = plane.distanceToPoint(points[ii]);
            if (Math.abs(dist) < THRESHOLD) {
                counts++;
            }
        }
        planes.push([counts, plane])
    }

    planes.sort((a,b)=>b[0]-a[0]);
    return planes;
}

window.RANSAC = RANSAC