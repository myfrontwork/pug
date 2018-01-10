"use strict";

// 사용하는 Node 모듈
const gulp          = require("gulp"),
    pump            = require("pump"),
    pug             = require("gulp-pug"),
    sass            = require("gulp-sass"),
    sourcemaps      = require('gulp-sourcemaps'), //(한컴)추가
    cleanCSS        = require("gulp-clean-css"),
    autoprefixer    = require("gulp-autoprefixer"),
    prettify        = require("gulp-jsbeautifier"),
    stripDebug      = require("gulp-strip-debug"),
    iife            = require("gulp-iife"),
    uglify          = require("gulp-uglify"),
    rename          = require("gulp-rename"),
    bs              = require("browser-sync").create();

// 경로 설정
const path = {
    resolve : (basepath, subpaths) => `${basepath}/${subpaths.join("/")}`,
    dest    : (...paths) => path.resolve("public", paths),
    src     : (...paths) => path.resolve("src", paths)
};

// browserSync 설정
const BS_CONTENT_BASE   = "public";
const BS_PORT           = 9000;

var scssOptions = { //(한컴)추가
    /** 
    * outputStyle (Type : String , Default : nested) 
    * CSS의 컴파일 결과 코드스타일 지정 
    * Values : nested, expanded, compact, compressed */
    outputStyle : "expanded", 
    /** 
    * indentType (>= v3.0.0 , Type : String , Default : space)
     * 컴파일 된 CSS의 "들여쓰기" 의 타입 
     * Values : space , tab */
    indentType : "tab",
    /** 
    * indentWidth (>= v3.0.0, Type : Integer , Default : 2) 
    * 컴파일 된 CSS의 "들여쓰기" 의 갯수 */
    indentWidth : 1,

    /** 
    * precision (Type : Integer , Default : 5) 
    * 컴파일 된 CSS 의 소수점 자리수. */
    precision: 6,

    /** 
    * sourceComments (Type : Boolean , Default : false) 
    * 컴파일 된 CSS 에 원본소스의 위치와 줄수 주석표시. */
    sourceComments: true
};

// compile:pug
gulp.task("compile:pug", cb => {
    pump([
        // 소스 경로에서 pug 파일을 가져옴 (서브폴더는 제외)
        gulp.src(path.src("pug", "*.pug")),
        // pug를 html로 컴파일 -- https://www.npmjs.com/package/gulp-pug
        pug(),
        // 리포맷 -- https://github.com/tarunc/gulp-jsbeautifier
        prettify({
            indent_size: 4,
            indent_char: " ",
            unformatted: ["code", "pre", "em", "strong", "span"] // beautify 하지 말아야 할 요소들
        }),
        // 출력 경로에 삽입
        gulp.dest(path.dest())
    ], cb);
});


// compile:sass
gulp.task("compile:sass", cb => {
    pump([
        // 소스 경로에서 index.scss를 가져옴
        gulp.src(path.src("scss", "index.scss")),
        // sass를 css로 컴파일 -- https://github.com/sass/node-sass#options

        sourcemaps.init(),//(한컴)추가
        sass(scssOptions).on('error', sass.logError),//(한컴)수정

        // 크로스브라우징을 위한 프로퍼티 접두 -- https://github.com/postcss/autoprefixer#options
        autoprefixer({
            browsers: [
                "Firefox > 29",
                "Explorer > 8",
                "iOS 7",
                "Android 4.1"
            ],
            remove: false
        }),
        // 리포맷 & 최적화 -- https://github.com/jakubpawlowicz/clean-css#how-to-use-clean-css-api
        cleanCSS({
            format: {
                breaks: {
                    afterAtRule         : false,
                    afterBlockBegins    : false,
                    afterBlockEnds      : false,
                    afterComment        : true,
                    afterProperty       : false,
                    afterRuleBegins     : false,
                    afterRuleEnds       : false,
                    beforeBlockEnds     : false,
                    betweenSelectors    : false
                },
                spaces: {
                    aroundSelectorRelation  : false,
                    beforeBlockBegins       : false,
                    beforeValue             : false
                }
            },
            level: 0
        }),
        // 파일명을 변경 -- https://www.npmjs.com/package/gulp-rename
        rename(path => {
            path.basename = "style";
        }),
        sourcemaps.write(),//(한컴)추가
        // 소스 경로에 삽입
        gulp.dest(path.dest("ui")),
        // 활성화된 browserSync를 갱신 (새로고침 없이 해당 스타일시트만 갱신)
        bs.stream()
    ], cb);
});



// compile:js
gulp.task("compile:js", cb => {
    pump([
        // 소스 경로에서 index.js 파일을 가져옴
        gulp.src(path.src("js", "index.js")),
        // 디버그 선언을 제거 -- https://github.com/sindresorhus/gulp-strip-debug#usage
        //stripDebug(),
        // IIFE 랩퍼로 캡슐화 -- https://www.npmjs.com/package/gulp-iife#options
        iife({
            useStrict: true,
            prependSemicolon: true,
            args: ["window", "document", "jQuery"],
            params: ["window", "document", "$", "undefined"]
        }),
        // 압축 -- https://github.com/mishoo/UglifyJS2#minify-options
        //uglify(),
        // 파일명을 변경 -- https://www.npmjs.com/package/gulp-rename
        rename(path => {
            path.basename = "script";
        }),
        // 소스 경로에 삽입
        gulp.dest(path.dest("ui"))
    ], cb);
    
});

// sync:init
gulp.task("sync:init", () => {
    // browserSync 초기화 -- https://browsersync.io/docs/options
    bs.init({
        server  : BS_CONTENT_BASE,
        port    : BS_PORT,
        open    : false,
        notify  : false
    });
});

// sync:reload -- browserSync에 연결된 브라우저들을 새로고침
gulp.task("sync:reload", () => bs.reload);

// build -- 모든 리소스를 순차적으로 컴파일
gulp.task("build", ["compile:pug", "compile:sass", "compile:js"]);

// watch -- brwoserSync를 열고 리소스 갱신을 감시
gulp.task("watch", ["build", "sync:init"], () => {
    gulp.watch(path.src("pug/**/*.pug"), ["compile:pug", bs.reload]);
    gulp.watch(path.src("scss/**/*.scss"), ["compile:sass"]);
    gulp.watch(path.src("js/**/*.js"), ["compile:js", bs.reload]);
});

// `gulp`만 CLI에 입력했을 때 취할 액션
gulp.task("default", ["build"]);