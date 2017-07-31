const fs = require("fs");

function readFile(fileName) {
	return new Promise((res, rej) =>
		fs.readFile(fileName, (e, d) => e ? rej(e) : res(d.toString())));
}

function writeFile(fileName, content) {
	return new Promise((res, rej) =>
		fs.writeFile(fileName, content, e => e ? rej(e) : res()));
}

function readDir(dirName) {
	return new Promise((res, rej) =>
		fs.readdir(dirName, (e, d) => e ? rej(e) : res(d)));
}

// res when exists, rej when doesn't exists
function checkPath(dirName) {
	return new Promise((res, _) => fs.exists(dirName, b => res(b)));
}

function makeDir(dirName) {
	return new Promise((res, rej) =>
		fs.mkdir(dirName, e => e ? rej(e) : res()));
}

// ensure the directory exists
async function ensureDir(dirName) {
	const exists = await checkPath(dirName);
	if (!exists)
		await makeDir(dirName);
}


module.exports = {
	readFile,
	writeFile,
	readDir,
	ensureDir,
};

