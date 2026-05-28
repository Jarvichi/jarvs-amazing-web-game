
// All of thes etiles should be rendered with trnansparent backgrounds, so they can be layered on top of the base chip tiles (eg to add decor on top of ground tiles, or to add height variation to the terrain with height tiles).
export const BASE_CHIP_TILES = {
    lightGrass: 0,
    mediumGrass: 1,
    darkGrass: 2,
    dyingGrass: 3,
    sand: 4,
    lightDirt: 5,
    mediumDirt: 6,
    darkDirt: 7,

    // ── Special tiles (not used in base chip) ─────────────────────────────────

    // Trees (for tree chipsheet) — each tree is 2 tiles wide and 2 tiles tall, with separate top and bottom halves to allow layering with the player avatar.
    lightTreeTopLeft: 8,
    lightTreeTopRight: 9,
    darkTreeTopLeft: 10,
    darkTreeTopRight: 11,
    autumnTreeTopLeft: 12,
    autumnTreeTopRight: 13,
    deadTreeTopLeft: 14,
    deadTreeTopRight: 15,
    lightTreeBottomLeft: 16,
    lightTreeBottomRight: 17,
    darkTreeBottomLeft: 18,
    darkTreeBottomRight: 19,
    autumnTreeBottomLeft: 20,
    autumnTreeBottomRight: 21,
    deadTreeBottomLeft: 22,
    deadTreeBottomRight: 23,
    // Tree columns (for another row of trees infront of the first, with same tops but different bottoms):
    // Note: these go between the top and bottom tree tiles (eg lightTreeColumnLeft is between lightTreeTopLeft and lightTreeBottomLeft) so that they can be used in the same tilemap layer as the top and bottom tree tiles.   
    lightTreeColumnLeft: 24,
    lightTreeColumnRight: 25,
    darkTreeColumnLeft: 26,
    darkTreeColumnRight: 27,
    autumnTreeColumnLeft: 28,
    autumnTreeColumnRight: 29,
    deadTreeColumnLeft: 30,
    deadTreeColumnRight: 31,
    // Tree columns staggered (for a more natural look, with some trees slightly infront of others):
    // Note: these go between the top and bottom tree tiles (eg a typical layout might be:
    //       colum 0  colum 1, column 2, column 3
    // row 0   empty,  treeTopLeft,  treeTopRight, empty
    // row 1   treeTopLeft, lightTreeColumnRightStaggered, lightTreeColumnLeftStaggered, treeTopRight
    // row 2   treeBottomLeft, treeBottomRight, treeBottomLeft, treeBottomRight
    // This would show 3 tree in a triangular layout, with the middle tree slightly behind the other two.
    lightTreeColumnLeftStaggered: 32,
    lightTreeColumnRightStaggered: 33,
    darkTreeColumnLeftStaggered: 34,
    darkTreeColumnRightStaggered: 35,
    autumnTreeColumnLeftStaggered: 36,
    autumnTreeColumnRightStaggered: 37,
    deadTreeColumnLeftStaggered: 38,
    deadTreeColumnRightStaggered: 39,

    // Bushes
    lightBush: 40,
    darkBush: 41,
    autumnBush: 42,
    deadBush: 43,

    // Wood
    smallStump: 44,
    largeStump: 45,
    // Horizontally oriented log tiles (for fallen trees, etc) — these go between the left and right tree tiles so they can be used in the same tilemap layer as the tree tops and bottoms.
    logLeft: 46,
    logRight: 47,
    // Vertically oriented log tiles (for fallen trees, etc) — these go between the top and bottom tree tiles so they can be used in the same tilemap layer as the tree tops and bottoms.    
    logTop: 63,
    logBottom: 71,

    // Plants
    grassTuft: 48,
    smallGrass: 49,
    deadGrassTuft: 50,
    deadSmallGrass: 51,
    whiteFlower: 52,
    pinkFlower: 53,
    blueFlower: 54,
    yellowFlower: 55,
    brownMushroom: 56,
    purpleMushroom: 57,
    smallLilypad: 58,
    largeLilypad: 59,

    // Puddles
    lightPuddle: 60,
    darkPuddle: 61,
    greenPuddle: 62,

    // Rocks
    smallRock: 64,
    largeRock: 65,

    // Other
    hole: 66,
    graveStone: 67,
    graveWoodenCross: 68,
    campfireUnlit: 69,
    summoningCircle: 70,

    // Height tiles (for vertical environment)


    // Ploughed field tiles (for farm environment)
    topLeftPlough: 152,
    topPlough: 153,
    topRightPlough: 154,
    leftPlough: 160,
    centerPlough: 161,
    rightPlough: 162,
    bottomLeftPlough: 168,
    bottomPlough: 169,
    bottomRightPlough: 170,
    isolatedPlough: 171,
    scarecrowTop: 155,
    scarecrowBottom: 163,
    cropShoot: 156,
    cropWheatTop: 157,
    cropCarrot: 158,
    cropSpinach: 159,
    cropDead: 164,
    cropWheatMiddle: 165,
    cropPumkin: 166,
    cropLettuce: 167,
    cropRose: 172,
    cropWheatBottom: 173,
    cropBeans: 174,
    cropBerries: 175,

    // Fences (direction denotes the direction that can be linked to another fence tile, eg fenceLeft can link to another fence tile on its left side, but not its right side. Fences can link to path tiles to form gates, but not to other fence tiles, so they need separate tiles for corners and standalone pieces.)
    fenceTopBotton: 176,
    fenceBotton: 177,
    fenceRightBottom: 178,
    fenceLeftBottom: 179,
    fenceLeft: 180,
    fenceLeftRightTop: 181,
    fenceLeftRightBottom: 182,
    fenceLeftRightTopBottom: 183,
    fenceLeftRight: 184,
    fenceTop: 185,
    fenceTopRight: 186,
    fenceLeftTop: 187,
    fenceRight: 188,
    fenceTopRightBottom: 189,
    fenceLeftTopBottom: 190,
    fenceIsolated: 191,

    ironFenceTopBotton: 192,
    ironFenceBotton: 193,
    ironFenceRightBottom: 194,
    ironFenceLeftBottom: 195,
    ironFenceLeft: 196,
    ironFenceLeftRightTop: 197,
    ironFenceLeftRightBottom: 198,
    ironFenceLeftRightTopBottom: 199,
    ironFenceLeftRight: 200,
    ironFenceTop: 201,
    ironFenceTopRight: 202,
    ironFenceLeftTop: 203,
    ironFenceRight: 204,
    ironFenceTopRightBottom: 205,
    ironFenceLeftTopBottom: 206,
    ironFenceIsolated: 207,

    stoneWallTopBotton: 208,
    stoneWallBotton: 209,
    stoneWallRightBottom: 210,
    stoneWallLeftBottom: 211,
    stoneWallLeft: 212,
    stoneWallLeftRightTop: 213,
    stoneWallLeftRightBottom: 214,
    stoneWallLeftRightTopBottom: 215,
    stoneWallLeftRight: 216,
    stoneWallTop: 217,
    stoneWallTopRight: 218,
    stoneWallLeftTop: 219,
    stoneWallRight: 220,
    stoneWallTopRightBottom: 221,
    stoneWallLeftTopBottom: 222,
    stoneWallIsolated: 223,


    // Other
    boardwalkVertical: 224,
    boardwalkHorizontal: 225,
    stoneWell: 226,
    bucketAndRope: 227,
    mailBox: 228,
    roadSignTop: 229,
    messageBoardTopLeft: 230,
    messageBoardTopRight: 231,
    boardwalkVerticalSupport: 232,
    boardwalkHorizontalSupport: 233,
    smallSign: 234,
    mediumSign: 235,
    largeSign: 236,
    roadSignBottom: 237,
    messageBoardBottomLeft: 238,
    messageBoardBottomRight: 239,

    // Various 240 - 287

    // Flooring
    woodFloor: 288,
    stoneFloor: 289,
    cobblestoneFloor: 290,
    quarteredFloor: 291,
    checkeredFloor: 292,
    redCarpetFloor: 293,
    fullLadderTop: 294,
    halfLadderTop: 295,
    darkWoodFloor: 296,
    darkStoneFloor: 297,
    darkCobblestoneFloor: 298,
    darkQuarteredFloor: 299,
    darkCheckeredFloor: 300,
    yellowCarpetFloor: 301,
    ladderBottom: 302,
    ladderIntoFloor: 303,
    parquetFloor: 304,
    smallStoneFloor: 305,   
    diagonalFloor: 306,
    fourByFourTileFloor: 307,
    meshFloor: 308,
    ornateFloor: 309,
    stepsUpFromLeft: 310,
    stepsUpFromRight: 311,
    darkParquetFloor: 312,
    goldSmallTileFloor: 313,
    darkDiagonalFloor: 314,
    darkFourByFourTileFloor: 315,
    lightMeshFloor: 316,
    blueOrnateFloor: 317,

    // Many more tiles up to 656 for various decor, furniture, etc.

    // Shop Signs
    weaponsSign: 656    ,
    armourSign: 657      ,
    bagSign: 658      ,
    foodSign: 659       ,
    drinkSign: 660      ,
    teaSign: 661        ,
    magicSign: 662      ,
    ringSign: 663       ,
    innSign: 664        ,
    healthSign: 665     ,
    appleSign: 666       ,
    bookSign: 667        ,
    goldSign: 668        ,
    wolfSign: 669        ,
    skullSign: 670       ,
    blankSign: 671     ,

    // Many more tiles

    // Storage
    lightPotWithLid: 856,
    lightPotWithoutLid: 857,
    darkPotWithLid: 858,
    darkPotWithoutLid: 859,
    crate: 860,
    chest: 861,
    strongChest: 862,
    goldChest: 863,
    fullBucket: 864,
    emptyBucket: 865,   
    logPile: 866,
    choppingBlock: 867,
    openCrate: 868,
    openChest: 869,
    openStrongChest: 870,
    openGoldChest: 871,
    sack: 872,
    hayStack: 873,
    pileOfSacks: 874,
    barrel: 875,
    emptyBasket: 876,
    appleBasket: 877,
    leafBasket: 878,
    mushroomBasket: 879,

    // Many More

    // Statues
    darkPillarTop:905,
    lightPillarTop:905,
    birdBathTop: 906,
    brazierTop: 907,
    knightTop:908,
    stripedShopAwningTop: 909,
    plainShowAwningTop:910,
    tallBushTop:911,
    darkPillarMiddle:912,
    lightPillarMiddle:913,
    birdBathMiddle:914,
    brazierBottom:915,
    knightBottom:916,
    stripedShopAwningMiddle: 917,
    plainShowAwningMiddle:918,
    tallBushPot:919,
    darkPillarBottom:920,
    lightPillarBottom:921,
    birdBathBottom: 921,
    // then
    // angel statue top, gargoyle top, striped awning bottom, plain awning bottom, spiky plant top,
    // fountain top left, top middle, top right
    // angal statue bottom, gargoyle bottom, striped awning with support, plain awning with support, spiky plant bottom,
    // fountain mid left, mid middle, mid right,
    // memorial top left, memorial top right, striped awning support pillar, plain awning support pillar, pot of flowers, 
    // fountain bot left, bot middle, bot right,
    // memorial bot left, memorial bot right, striped awning support pillar bot, plain awning support pillar bot, empty pot of flowers, 


    closedBook: 952,
    openBook: 953,
    blueclosedBook: 954,
    blueopenBook: 955,
    blackclosedBook: 956,
    blackopenBook: 957,
    greenclosedBook: 958,
    greenopenBook: 959,


} as const