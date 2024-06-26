/**
 * PriorityQueue
 * Elements in this queue are sorted according to their value
 *
 * @author Lukasz Krawczyk <contact@lukaszkrawczyk.eu>
 * @copyright MIT
 */

/**
 * PriorityQueue class construcotr
 * @constructor
 *
 * @example
 * queue: [1,2,3,4]
 * priorities: [4,1,2,3]
 * > result = [1,4,2,3]
 *
 * @param {Array} elements
 * @param {Array} priorities
 * @param {string} sorting - asc / desc
 * @returns {PriorityQueue}
 */
function PriorityQueue(elements, priorities, sorting) {
    /** @type {Array} */
    this._queue = [];
    /** @type {Array} */
    this._priorities = [];
    /** @type {string} */
    this._sorting = 'desc';
  
    this._init(elements, priorities, sorting);
  };
  
  /**
   * Insert element
   *
   * @param {Object} ele
   * @param {Object} priority
   * @returns {undefined}
   * @access public
   */
  PriorityQueue.prototype.insert = function(ele, priority) {
    var indexToInsert = this._queue.length;
    var index = indexToInsert;
  
    while (index--) {
      var priority2 = this._priorities[index];
      if (this._sorting === 'desc') {
        if (priority > priority2) {
          indexToInsert = index;
        }
      } else {
        if (priority < priority2) {
          indexToInsert = index;
        }
      }
    }
  
    this._insertAt(ele, priority, indexToInsert);
  };
  
  /**
   * Remove element
   *
   * @param {Object} ele
   * @returns {undefined}
   * @access public
   */
  PriorityQueue.prototype.remove = function(ele) {
    var index = this._queue.length;
  
    while (index--) {
      var ele2 = this._queue[index];
      if (ele === ele2) {
        this._queue.splice(index, 1);
        this._priorities.splice(index, 1);
        break;
      }
    }
  };
  
  /**
   * For each loop wrapper
   *
   * @param {function} func
   * @returs {undefined}
   * @access public
   */
  PriorityQueue.prototype.forEach = function(func) {
    this._queue.forEach(func);
  };
  
  /**
   * @returns {Array}
   * @access public
   */
  PriorityQueue.prototype.getElements = function() {
    return this._queue;
  };
  
  /**
   * @param {number} index
   * @returns {Object}
   * @access public
   */
  PriorityQueue.prototype.getElementPriority = function(index) {
    return this._priorities[index];
  };
  
  /**
   * @returns {Array}
   * @access public
   */
  PriorityQueue.prototype.getPriorities = function() {
    return this._priorities;
  };
  
  /**
   * @returns {Array}
   * @access public
   */
  PriorityQueue.prototype.getElementsWithPriorities = function() {
    var result = [];
  
    for (var i = 0, l = this._queue.length; i < l; i++) {
      result.push([this._queue[i], this._priorities[i]]);
    }
  
    return result;
  };
  
  /**
   * Set object properties
   *
   * @param {Array} elements
   * @param {Array} priorities
   * @returns {undefined}
   * @access protected
   */
  PriorityQueue.prototype._init = function(elements, priorities, sorting) {
  
    if (elements && priorities) {
      this._queue = [];
      this._priorities = [];
  
      if (elements.length !== priorities.length) {
        throw new Error('Arrays must have the same length');
      }
  
      for (var i = 0; i < elements.length; i++) {
        this.insert(elements[i], priorities[i]);
      }
    }
  
    if (sorting) {
      this._sorting = sorting;
    }
  };
  
  /**
   * Insert element at given position
   *
   * @param {Object} ele
   * @param {number} index
   * @returns {undefined}
   * @access protected
   */
  PriorityQueue.prototype._insertAt = function(ele, priority, index) {
    if (this._queue.length === index) {
      this._queue.push(ele);
      this._priorities.push(priority);
    } else {
      this._queue.splice(index, 0, ele);
      this._priorities.splice(index, 0, priority);
    }
  };
  
export default PriorityQueue;