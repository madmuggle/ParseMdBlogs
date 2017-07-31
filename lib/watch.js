const { readFile, writeFile, readDir, ensureDir } = require('./myfs');
const { error, info } = require('./log');
const mysort = require('./mysort');

const marked = require('marked');
const ejs = require('ejs');
const fs = require('fs');

const TMPLDIR = `${__dirname}/../resources/template`;
const PAGESIZE = 30;

/**
 * Get SRCDIR and DESTDIR from Environment variable first, many process rely
 * on these 2 variables.
 */
const { SRCDIR, DESTDIR } = process.env;

/**
 * metaDB stores meta information of articles(content not included), it should
 * be something like this:
 * [
 *  { title: 'T', tags: [ A, B ], date: '2016', url: 'http://a' },
 *  ...
 * ]
 */
const metaDB = [];

var shouldUpdateIndex = true;


function ensureEnvironment() {
	if (SRCDIR && DESTDIR) return;
	error('Environment variable "SRCDIR" or "DESTDIR" were not defined');
	process.exit(1);
}

function getField(field, str) {
	const reg = new RegExp(`^\\s*${field}\\s*:\\s*([^\\s]+.*)`, 'm');
	const r = reg.exec(str);
	if (!r)
		throw new Error(`Meta Error: no ${field}`);
	return r[1].trim();
}

/**
 * 'date: 2016/10/01 21:05:00\ntitle: Test\ntag: A, B\n\n'
 * => { title: 'Test', date: '2016/10/01 21:05:00', tags: [ 'A', 'B' ] }
 */
function parseMeta(metaStr) {
	const tags = getField('tag', metaStr).split(/[\s,，]/).filter(x => x);
	const title = getField('title', metaStr);
	const date = getField('date', metaStr);
	return { title, date, tags };
}

function updateMetaDbRecord(rcd, newData) {
	rcd.title = newData.title;
	rcd.date = newData.date;
	rcd.tags = newData.tags;
	rcd.url = newData.url;
}

function arrayEqual(a1, a2) {
	if (a1.length !== a2.length)
		return false;
	for (var i = 0, l = a1.length; i < l; i++)
		if (a1[i] !== a2[i])
			return false;
	return true;
}

function recordChanged(rcd, newData) {
	return (
		(rcd.title != newData.title) ||
		(rcd.date != newData.date) ||
		!arrayEqual(rcd.tags, newData.tags)
	);
}

function updateMetaDb(meta) {
	const r = metaDB.find(x => x.url === meta.url);
	if (r) {
		if (recordChanged(r, meta))
			shouldUpdateIndex = true;
		updateMetaDbRecord(r, meta);
	} else {
		shouldUpdateIndex = true;
		metaDB.push(meta);
	}
}

/**
 * give the option `filename`, then you can use `include` in ejs.
 * e.g. <%- include("template/sidebar") %>
 */
function render(templateStr, data) {
	return ejs.render(templateStr, data, { filename: TMPLDIR });
}

function getNthBlock(arr, n) {
	const startIdx = PAGESIZE * n;
	return arr.slice(startIdx, startIdx + PAGESIZE);
}

async function writeIndex(pageNum, pageCount, articleList) {
	const name = pageNum > 0 ? `indexes/${pageNum+1}.html` : `index.html`;
	info(`Writing ${name}...`);

	const tmpl = await readFile(`${TMPLDIR}/index.ejs`);
	const content = render(tmpl, { pageCount, pageNum, articleList });

	await writeFile(`${DESTDIR}/${name}`, content);
}

async function writeIndexes() {
	const articleMetas = mysort(metaDB, (x, y) => x.date < y.date);
	const pageCount = Math.ceil(articleMetas.length / PAGESIZE);

	for (var i = 0; i < pageCount; i++)
		await writeIndex(i, pageCount, getNthBlock(articleMetas, i));
}

async function parseArticle(fileName) {
	const name = /.*?([^\/]*)\.md$/.exec(fileName)[1];
	info(`Handling <${name}>...`);

	const content = await readFile(fileName);
	const spliter = ~content.indexOf('\r\n') ? '\r\n\r\n' : '\n\n';

	const spliterIdx = content.indexOf(spliter);
	if (spliterIdx === -1)
		throw new Error('Meta Error: no meta');

	const rawMeta = content.slice(0, spliterIdx);
	const rawArticle = content.slice(spliterIdx);

	const meta = parseMeta(rawMeta);
	meta.url = `/articles/${name}.html`;

	// Do not add meta of 404 to metaDB
	if (meta.date !== '-')
		updateMetaDb(meta);

	const parsedArticle = marked(rawArticle);

	const tmpl = await readFile(`${TMPLDIR}/article.ejs`);
	const parsedHTML = render(tmpl, { meta, parsedArticle });

	await writeFile(`${DESTDIR}/articles/${name}.html`, parsedHTML);
}

/** All markdown files that changed will be pushed to this Array. */
var changedFiles = [];

/** Check whether the file exists in changedFiles */
function checkNew(fileName) {
	return changedFiles.indexOf(fileName) === -1;
}

function checkMd(fileName) {
	return /.*\.md$/.test(fileName);
}

function updateChangedFiles(fileName) {
	if (checkMd(fileName) && checkNew(fileName))
		changedFiles.push(fileName);
}

async function loop() {
	setTimeout(() => loop().catch(error), 2000);
	if (changedFiles.length === 0)
		return;

	const tmp = changedFiles;
	changedFiles = [];
	for (var f of tmp)
		await parseArticle(`${SRCDIR}/${f}`);

	if (!shouldUpdateIndex)
		return;

	shouldUpdateIndex = false;
	await writeIndexes();
}

async function start() {
	// The environment variable "SRCDIR" and "DESTDIR" should be defined.
	ensureEnvironment();

	// Monitor the markdown source direcotry
	fs.watch(SRCDIR, (_ev, f) => updateChangedFiles(f));

	// Make sure all related directory exists
	await ensureDir(DESTDIR);
	await ensureDir(`${DESTDIR}/css`);
	await ensureDir(`${DESTDIR}/js`);
	await ensureDir(`${DESTDIR}/indexes`);
	await ensureDir(`${DESTDIR}/articles`);

	// Trigger recompile at start
	const files = await readDir(SRCDIR);
	files.forEach(updateChangedFiles);

	// Start the main function
	// No need to wait it finishes here
	loop().catch(error);
}

start().catch(error);

