//npm install --save-dev gulp-concat gulp-minify-html gulp-minify-css gulp-uglify gulp-rename
const gulp = require('gulp')
    , source = require('vinyl-source-stream')
    , buffer = require('vinyl-buffer')
    , fs = require("fs")
    , minifyHtml = require("gulp-minify-html")
    , gp_concat = require('gulp-concat')
    , gp_rename = require('gulp-rename')
    , gp_uglify = require('gulp-uglify')
    , minifyCss = require("gulp-minify-css")
    , del = require('del')
    , runSequence = require('run-sequence')
    , babel = require('gulp-babel')
    , babel_env = require('babel-preset-env')
    , execSync = require('child_process').execSync
    , exec = require('child_process').exec
    , merge = require('merge-stream')
    , zip = require('gulp-zip')
    , crypto = require('crypto')
    ;

gulp.task('clean', (cb) => {
    // return del.sync(['./dist']);
    return del([
        './dist'
    ], cb);
    //execSync("rm -rf " + "www");
});

gulp.task('bspa', function (cb) {
    exec('npm run build', function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        cb(err);
    });
})
gulp.task('snode', function (cb) {
    exec('node svr/app.js', function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        cb(err);
    });
})

gulp.task('default', callback => {
    runSequence('bspa'
        // ,'snode'
        ,callback);
});
gulp.task('rs', function () {
    execSync(`sh rlup.sh ${bundle_name}`);
});
