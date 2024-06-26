/**
 * KMEANS clustering
 *
 * @author Lukasz Krawczyk <contact@lukaszkrawczyk.eu>
 * @copyright MIT
 */

/**
 * KMEANS class constructor
 * @constructor
 *
 * @param {Array} dataset
 * @param {number} k - number of clusters
 * @param {function} distance - distance function
 * @returns {KMEANS}
 */
function KMEANS(dataset, k, distance) {
    this.k = 3; // number of clusters
    this.dataset = []; // set of feature vectors
    this.assignments = []; // set of associated clusters for each feature vector
    this.centroids = []; // vectors for our clusters
  
    this.init(dataset, k, distance);
  }
  
  /**
   * @returns {undefined}
   */
  KMEANS.prototype.init = function(dataset, k, distance) {
    this.assignments = [];
    this.centroids = [];
  
    if (typeof dataset !== 'undefined') {
      this.dataset = dataset;
    }
  
    if (typeof k !== 'undefined') {
      this.k = k;
    }
  
    if (typeof distance !== 'undefined') {
      this.distance = distance;
    }
  };
  
  /**
   * @returns {undefined}
   */
  KMEANS.prototype.run = function(dataset, k) {
    this.init(dataset, k);
  
    var len = this.dataset.length;
  
    // initialize centroids
    for (var i = 0; i < this.k; i++) {
      this.centroids[i] = this.randomCentroid();
      }
  
    var change = true;
    while(change) {
  
      // assign feature vectors to clusters
      change = this.assign();
  
      // adjust location of centroids
      for (var centroidId = 0; centroidId < this.k; centroidId++) {
        var mean = new Array(maxDim);
        var count = 0;
  
        // init mean vector
        for (var dim = 0; dim < maxDim; dim++) {
          mean[dim] = 0;
        }
  
        for (var j = 0; j < len; j++) {
          var maxDim = this.dataset[j].length;
  
          // if current cluster id is assigned to point
          if (centroidId === this.assignments[j]) {
            for (var dim = 0; dim < maxDim; dim++) {
              mean[dim] += this.dataset[j][dim];
            }
            count++;
          }
        }
  
        if (count > 0) {
          // if cluster contain points, adjust centroid position
          for (var dim = 0; dim < maxDim; dim++) {
            mean[dim] /= count;
          }
          this.centroids[centroidId] = mean;
        } else {
          // if cluster is empty, generate new random centroid
          this.centroids[centroidId] = this.randomCentroid();
          change = true;
        }
      }
    }
  
    return this.getClusters();
  };
  
  /**
   * Generate random centroid
   *
   * @returns {Array}
   */
  KMEANS.prototype.randomCentroid = function() {
    var maxId = this.dataset.length -1;
    var centroid;
    var id;
  
    do {
      id = Math.round(Math.random() * maxId);
      centroid = this.dataset[id];
    } while (this.centroids.indexOf(centroid) >= 0);
  
    return centroid;
  }
  
  /**
   * Assign points to clusters
   *
   * @returns {boolean}
   */
  KMEANS.prototype.assign = function() {
    var change = false;
    var len = this.dataset.length;
    var closestCentroid;
  
    for (var i = 0; i < len; i++) {
      closestCentroid = this.argmin(this.dataset[i], this.centroids, this.distance);
  
      if (closestCentroid != this.assignments[i]) {
        this.assignments[i] = closestCentroid;
        change = true;
      }
    }
  
    return change;
  }
  
  /**
   * Extract information about clusters
   *
   * @returns {undefined}
   */
  KMEANS.prototype.getClusters = function() {
    var clusters = new Array(this.k);
    var centroidId;
  
    for (var pointId = 0; pointId < this.assignments.length; pointId++) {
      centroidId = this.assignments[pointId];
  
      // init empty cluster
      if (typeof clusters[centroidId] === 'undefined') {
        clusters[centroidId] = [];
      }
  
      clusters[centroidId].push(pointId);
    }
  
    return clusters;
  };
  
  // utils
  
  /**
   * @params {Array} point
   * @params {Array.<Array>} set
   * @params {Function} f
   * @returns {number}
   */
  KMEANS.prototype.argmin = function(point, set, f) {
    var min = Number.MAX_VALUE;
    var arg = 0;
    var len = set.length;
    var d;
  
    for (var i = 0; i < len; i++) {
      d = f(point, set[i]);
      if (d < min) {
        min = d;
        arg = i;
      }
    }
  
    return arg;
  };
  
  /**
   * Euclidean distance
   *
   * @params {number} p
   * @params {number} q
   * @returns {number}
   */
  KMEANS.prototype.distance = function(p, q) {
    var sum = 0;
    var i = Math.min(p.length, q.length);
  
    while (i--) {
      var diff = p[i] - q[i];
      sum += diff * diff;
    }
  
    return Math.sqrt(sum);
  };

  export default KMEANS;