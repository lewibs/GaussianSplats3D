export default class IDBSCAN {
    constructor(epsilon, minPts) {
      this.dataset = {};
      this.epsilon = epsilon;
      this.minPts = minPts;
      this.clusters = [];
      this.noise = [];
      this._visited = {};
      this._assigned = {};
      this._datasetLength = 0;
    }
  
    add(id, data) {
      if (this._visited[id] !== 1) {
        this._visited[id] = 1;
        this.dataset[id] = data
  
        let neighbors = this._regionQuery(id);
  
        if (neighbors.length < this.minPts) {
          this.noise.push(id);
        } else {
          let clusterId = this.clusters.length
          this.clusters.push([]);
          this._addToCluster(id, clusterId);
          this._expandCluster(clusterId, neighbors);
        }
      }
  
      return this.clusters;
    }
  
    distance(p, q) {
      var sum = 0;
      var i = Math.min(p.length, q.length);
    
      while (i--) {
        sum += (p[i] - q[i]) * (p[i] - q[i]);
      }
    
      return Math.sqrt(sum);
    };
  
    _regionQuery(id) {
      var neighbors = [];
    
      Object.keys(this.dataset).forEach((pointId)=>{
        var dist = this.distance(this.dataset[pointId], this.dataset[id]);
        if (dist < this.epsilon) {
          neighbors.push(id);
        }
      });
    
      return neighbors;
    }
  
    _addToCluster(id, clusterId) {
      this.clusters[clusterId].push(id);
      //TODO this can be changed to the cluster id unsure how useful that would be.
      this._assigned[id] = 1;
    }
  
    _expandCluster(clusterId, neighbors) {
      /**
       * It's very important to calculate length of neighbors array each time,
       * as the number of elements changes over time
       */
      for (var i = 0; i < neighbors.length; i++) {
        var pointId2 = neighbors[i];
    
        if (this._visited[pointId2] !== 1) {
          this._visited[pointId2] = 1;
          var neighbors2 = this._regionQuery(pointId2);
    
          if (neighbors2.length >= this.minPts) {
            neighbors = this._mergeArrays(neighbors, neighbors2);
          }
        }
    
        // add to cluster
        if (this._assigned[pointId2] !== 1) {
          this._addToCluster(pointId2, clusterId);
        }
      }
    }
  
    _mergeArrays(a, b) {
      var len = b.length;
    
      for (var i = 0; i < len; i++) {
        var P = b[i];
        if (a.indexOf(P) < 0) {
          a.push(P);
        }
      }
    
      return a;
    }
  }