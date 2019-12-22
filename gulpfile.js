const gulp = require('gulp');
const browserSync = require('browser-sync');
const changed = require('gulp-changed');
const cached = require('gulp-cached');
const sass = require('gulp-sass');
const sassGlob = require('gulp-sass-glob');
const moduleImporter = require('sass-module-importer');
const pug = require('gulp-pug');
const plumber = require('gulp-plumber');
const sourcemaps = require('gulp-sourcemaps');
const postcss = require('gulp-postcss');
const cssnext = require('postcss-cssnext');
const csscomb = require('gulp-csscomb');
const html2pug = require('gulp-html2pug');
const imagemin = require('gulp-imagemin');
const reload = browserSync.reload;

imagemin.mozjpeg = require('imagemin-mozjpeg');
imagemin.pngquant = require('imagemin-pngquant');
imagemin.pngcrush = require('imagemin-pngcrush');

const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const fs = require('fs');

const path = {};
path.html = {
	src: './src/html/**/*.html',
	ignore: '!./src/html/**/_*.html'
};
path.pug = {
	src: './src/pug/**/*.pug',
	ignore: '!./src/pug/**/_*.pug',
  destSelf: './src/pug',
  dest: './public'
};
path.sass = {
  src: './src/scss/**/*.scss',
  destSelf: './src/scss',
  dest: './public/css'
};
path.img = {
  src: './src/img/**/*',
  dest: './public/img'
};

/**
 * Compile pug files into HTML
 */
gulp.task('templates', () => {
	const YOUR_LOCALS = {
		message: 'This app is powered by gulp.pug recipe for BrowserSync'
	};

	return gulp
		.src([path.pug.src, path.pug.ignore])
		.pipe(cached('pug'))
		.pipe(plumber())
		.pipe(pug({
			locals: YOUR_LOCALS,
			pretty: true,
			basedir: path.pug.destSelf
		}))
		.pipe(gulp.dest(path.pug.dest));
});

/**
 * Important!!
 * Separate task for the reaction to `.pug` files
 */
gulp.task('pug-watch', ['templates'], reload);

gulp.task('html2pug', () => {
	return gulp
		.src([path.html.src, path.html.ignore])
		.pipe(html2pug())
		.pipe(gulp.dest(path.pug.destSelf));
})

/**
 * task for image optimization
 */
gulp.task('imagemin', () => {
	return gulp
		.src(path.img.src)
		.pipe(changed(path.img.dest))
		.pipe(plumber())
		.pipe(imagemin([
			imagemin.mozjpeg({ quality: 85, progressive: true }),
			imagemin.pngquant({ quality: '70-85' }),
			imagemin.pngcrush(),
			imagemin.svgo({
				plugins: [
					{ removeViewBox: true },
					{ cleanupIDs: true }
				]
			})
		]))
		.pipe(gulp.dest(path.img.dest));
});

/**
 * Sass task for automatically formats
 */
gulp.task('csscomb', () => {
	return gulp
		.src(path.sass.src)
		.pipe(plumber())
		.pipe(csscomb())
		.pipe(gulp.dest(path.sass.destSelf))
});

/**
 * Sass task for live injecting into all browsers
 */
gulp.task('sass', ['csscomb'], () => {
	const processors = [cssnext()];
	return gulp
		.src(path.sass.src)
		.pipe(plumber())
		.pipe(sassGlob())
		.pipe(sass({ importer: moduleImporter() })).on('error', sass.logError)
		.pipe(sourcemaps.init())
		.pipe(sourcemaps.write())
		.pipe(postcss(processors))
		.pipe(gulp.dest(path.sass.dest))
		.pipe(reload({ stream: true }));
});

gulp.task('build', ['imagemin', 'sass', 'templates']);

/**
 * Serve and watch the scss/pug files for changes
 */
gulp.task('default', ['sass', 'templates'], function() {
	browserSync({ server: path.pug.dest, notify: false });
	gulp.watch(path.sass.src, ['sass']);
	gulp.watch(path.pug.src, ['pug-watch']);
});

/**
 *
 */
async function scrollToBottom(page, viewportHeight) {
    const getScrollHeight = () => {
        return Promise.resolve(document.documentElement.scrollHeight) }

    let scrollHeight = await page.evaluate(getScrollHeight)
    let currentPosition = 0
    let scrollNumber = 0

    while (currentPosition < scrollHeight) {
        scrollNumber += 1
        const nextPosition = scrollNumber * viewportHeight
        await page.evaluate(function (scrollTo) {
            return Promise.resolve(window.scrollTo(0, scrollTo))
        }, nextPosition)
        await page.waitForNavigation({waitUntil: 'networkidle2', timeout: 5000})
            .catch(e => console.log('timeout exceed. proceed to next operation'));

        currentPosition = nextPosition;
        console.log(`scrollNumber: ${scrollNumber}`)
        console.log(`currentPosition: ${currentPosition}`)

        // 2
        scrollHeight = await page.evaluate(getScrollHeight)
        console.log(`ScrollHeight ${scrollHeight}`)
    }
}

gulp.task('capture', function(){
    const checkUrl = [];

    fs.readFile('./list.csv', function (err, data) {
        var buf    = new Buffer(data, 'binary');
        var buf2 = buf.toString();


        let dataArray = buf2.split(/\r?\n/);
        for(let prop in dataArray){
            let ary = dataArray[prop].split(',');
            let obj = {
                url : ary[0],
                name : ary[1],
                width : Number(ary[2]),
                device : ary[3],
                clk : ary[4],
                clk2 : ary[5]
            };

            checkUrl.push(obj);
        }
        next();
    });

    function next(){
        const USERNAME = 'petabit';
        const PASSWORD = 'nPg1WRPk';

        (async () => {
            const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
            for (let index in checkUrl) {

                let data = checkUrl[index];

                let page = await browser.newPage();
                await page.setExtraHTTPHeaders({
                    Authorization: `Basic ${new Buffer(`${USERNAME}:${PASSWORD}`).toString('base64')}`
                });

                if(data.device==='sp'){
                    const iPhone = devices['iPad landscape'];
                    await page.emulate(iPhone);
                }

                let response = await page.goto(data.url,{waitUntil: 'load', timeout: 2000});
                let statusCode = response.status();
                if (statusCode !== 200 && statusCode !== 301) {
                    //外部に知らせる処理
                }

                let viewport = {};
                viewport.width = data.width;
                viewport.height = await page.evaluate(() => document.body.clientHeight);

                if(data.device==='sp'){
                    viewport.isMobile = true;
                }
                await page.setViewport(viewport);

                await scrollToBottom(page, viewport.height);

                if(data.clk){
                    const registerElement = await page.$(data.clk);
                    await registerElement.click();
                    if(data.clk2){
                        const registerElement2 = await page.$(data.clk2);
                        await registerElement2.click();
                    }
                }
                await scrollToBottom(page, viewport.height);

                let filename = `screen_shot/${data.name}.png`;
                await page.screenshot({path: filename, fullPage: true}); // スクリーンショット

                //let filename = `screen_shot/${data.name}.pdf`;
                //await page.pdf({path: filename, fullPage: true , printBackground:true });

                console.log(data.url + ' => saved : ' + filename);
            }
            await browser.close();
        })();
    }

});