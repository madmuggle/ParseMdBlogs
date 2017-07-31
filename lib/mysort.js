// Array.prototype.sort is buggy in V8, that's why this file exists

function bubbleSort(a, fn) {
	for (var i = a.length - 1; i >= 1; i--)
		for (var j = 0; j < i; j++)
			if (fn(a[j], a[j + 1]))
				swapArray(a, j, j + 1);
	return a;
}


function selectionSort(a, fn) {
	for (var i = a.length - 1; i >= 1; i--) {
		var pos = i;
		for (var j = 0; j < i; j++)
			if (fn(a[j], a[pos]))
				pos = j;
		if (i != pos)
			swapArray(a, i, pos);
	}
	return a;
}

function swapArray(a, i1, i2) {
	//console.log('Doing a swap...');
	[ a[i1], a[i2] ] = [ a[i2], a[i1] ];
}

function isFn(obj) {
	return typeof obj === 'function';
}

// give a default function when fn is not a valid function
function mysort(arr, fn) {
	//return bubbleSort(arr, isFn(fn) ? fn : (a, b) => a > b);
	return selectionSort(arr, isFn(fn) ? fn : (a, b) => a > b);
}

module.exports = mysort;

