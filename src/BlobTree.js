class BlobTree {
    _blob_rad = 0;
    dimentions = 0;
    blobs = [];

    constructor(dimentions, blob_rad) {
        this.dimentions = dimentions;
        this._blob_rad = blob_rad;
    }

    get length() {
        return this.blobs.length;
    }

    add(vector, value) {
        const node = new Node(vector, value);
        let blob = null

        if (this.blobs.length == 0) {
            blob = new Blob(this.dimentions);
            this.blobs.push(blob);
        } else {
            const [temp_blob, dist] = this.getNearestBlob(node.vector);
            blob = temp_blob;

            if (dist > this._blob_rad) { 
                blob = new Blob(this.dimentions);
                this.blobs.push(blob);
            }
        }

        blob.addNode(node);
        return [blob, node];
    }

    getNearestBlob(vector) {
        const dummy_node = new Node(vector, "temp");
        let min_blob = null
        let min_dist = Number.MAX_SAFE_INTEGER;
        let dist = 0;
        for (let i = 0; i < this.blobs.length; i++) {
            dist = dummy_node.distanceTo(this.blobs[i].mean);
            if ( dist < min_dist) {
                min_dist = dist;
                min_blob = this.blobs[i];
            }
        }
        return [min_blob, min_dist];
    }
}

class Blob {
    _meanSum = [];
    mean = [];
    //TODO switch this with a tree
    nodes = [];

    constructor(dimentions) {
        for (let i = 0; i<dimentions;i++) {
            this.mean.push(0);
            this._meanSum.push(0);
        }
    }

    get length() {
        return this.nodes.length;
    }

    addNode(node) {
        this.nodes.push(node);
        node.blob = this;
        for (let i = 0; i < this._meanSum.length; i++) {
            this._meanSum[i] += node.vector[i];
        }
        this.mean = this._meanSum.map((v)=>v/this.nodes.length);
    }
}

class Node {
    size = 0;
    vector = [];
    value = null
    blob = null;

    constructor(vector, value) {
        this.vector = vector;
        this.size = vector.length;
        this.value = value;
    }

    distanceTo(vector) {
        let sum = 0;
        for (let i = 0; i < this.vector.length; i++) {
            sum += Math.pow(vector[i] - this.vector[i], 2)
        }
        return Math.sqrt(sum)
    }
}

export default BlobTree