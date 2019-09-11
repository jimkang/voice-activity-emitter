function add(dict, key, value) {
  var array = dict[key];
  if (!array) {
    array = [];
    dict[key] = array;
  }
  array.push(value);
}

function remove(dict, key, value) {
  var array = dict[key];
  if (array) {
    let index = array.indexOf(value);
    if (index > -1) {
      array.splice(index, 1);
    }
  }
}

function clearValuesAtKey(dict, key) {
  var array = dict[key];
  if (array) {
    array.length = 0;
  }
}

function getValuesForKey(dict, key) {
  var values = dict[key];
  if (values && Array.isArray(values)) {
    return values;
  }
  return [];
}

module.exports = { add, remove, clearValuesAtKey, getValuesForKey };
