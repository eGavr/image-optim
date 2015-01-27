var Q = require('q'),
    qfs = require('q-io/fs'),
    File = require('./file');

/**
 * Overwrites the raw file by the compressed one if it is smaller otherwise removes it
 * @param {File} rawFile
 * @param {File} compressedFile
 * @returns {Promise * File}
 */
function _minFile(rawFile, compressedFile) {
    if (compressedFile.size < rawFile.size) {
        return qfs.move(compressedFile.name, rawFile.name)
            .then(function () {
                return new File(rawFile.name, compressedFile.size);
            });
    }

    return compressedFile.remove()
        .then(function () {
            return rawFile  ;
        });
}

/**
 * Checks whether the given raw file is smaller than the given compressed file
 * Removes the compressed file
 * @param {File} rawFile
 * @param {File} compressedFile
 * @param {Object} [options] -> lib/defaults.js
 * @param {Number} [options.tolerance] default: 0
 * @returns {Promise * Boolean}
 */
function _isSmallerAfterCompression(rawFile, compressedFile, options) {
    return compressedFile.remove()
        .then(function () {
            return rawFile.size - compressedFile.size > options.tolerance;
        });
}

/**
 * Modes
 * =====
 */
module.exports = {
    /**
     * Optimizes the given file
     * @param {File} pngFile
     * @param {Array} algorithms
     * @returns {Promise * Object|undefined}
     */
    optim: function (pngFile, algorithms) {
        /**
         * Helping reduce function
         * @param {Promise * File} prev
         * @param {Promise * File} next
         * returns {Promise * File}
         */
        function _reduceCompressFunc(prev, next) {
            return prev.then(function (minFile) {
                return next(pngFile)
                    .then(function (compressed) {
                        return _minFile(minFile, compressed);
                    });
            });
        }

        return pngFile.loadSize()
            .then(function () {
                return algorithms.reduce(_reduceCompressFunc, new Q(pngFile));
            })
            .then(function (minFile) {
                var savedBytes = pngFile.size - minFile.size;

                if (savedBytes > 0) return {
                    name: pngFile.name,
                    savedBytes: savedBytes
                };
            });
    },

    /**
     * Checks whether the given file can be optimized further
     * @param {File} pngFile
     * @param {Array} algorithms
     * @param {Object} [options] -> lib/defaults.js
     * @param {Number} [options.tolerance] default: 0
     * @returns {Promise * String}
     */
    lint: function (pngFile, algorithms, options) {
        /**
         * Helping reduce function
         * @param {Promise * Boolean} prev
         * @param {Promise * File} next
         * returns {Promise * Boolean}
         */
        function _reduceLintFunc(prev, next) {
            return prev.then(function (isSmaller) {
                return isSmaller || next(pngFile)
                    .then(function (compressed) {
                        return _isSmallerAfterCompression(pngFile, compressed, options);
                    });
            });
        }

        return pngFile.loadSize()
            .then(function () {
                return algorithms.reduce(_reduceLintFunc, new Q(false));
            })
            .then(function (isSmaller) {
                return isSmaller ? pngFile.name : '';
            });
    }
};