
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
    stoneCityWallTopBotton: 208,
    stoneCityWallBotton: 209,
    stoneCityWallRightBottom: 210,
    stoneCityWallLeftBottom: 211,
    stoneCityWallLeft: 212,
    stoneCityWallLeftRightTop: 213,
    stoneCityWallLeftRightBottom: 214,
    stoneCityWallLeftRightTopBottom: 215,
    stoneCityWallLeftRight: 216,
    stoneCityWallTop: 217,
    stoneCityWallTopRight: 218,
    stoneCityWallLeftTop: 219,
    stoneCityWallRight: 220,
    stoneCityWallTopRightBottom: 221,
    stoneCityWallLeftTopBottom: 222,
    stoneCityWallIsolated: 223,


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

    // Outdoor furniture / decor (verify exact IDs)
    lampPostTop:    907,
    lampPostBottom: 915,
    benchLeft:      848,
    benchMiddle:    849,
    benchRight:     850,
    flowerPotLeft:  943,
    flowerPotRight: 943,

    // Furniture sets (beds, tables, chairs) — verify exact IDs, 666 = placeholder
    // 4-tile royal bed (confirmed)
    royalBedTopLeft:939,
    royalBedTopRight:940,
    royalBedBottonLeft:941,
    royalBedBottomRight:942,
    royalBedTopLeftOverlay:939,
    royalBedTopRightOverlay:940,
    royalBedBottonLeftOverlay:941,
    royalBedBottomRightOverlay:942,


    // 2-tile bed (vertical, head on top side) - with overlay so npc can get into bed
    simpleBedHead:  776, // decor layer
    simpleBedFoot:  784, // decor layer
    simpleBedHeadOverlay: 792, // above npc layer
    simpleBedFootOverlay: 800, // above npc layer

    normalBedHead:  777, // decor layer
    normalBedFoot:  785, // decor layer
    normalBedHeadOverlay: 793, // above npc layer
    normalBedFootOverlay: 801, // above npc layer

    luxuryBedHead:  778, // decor layer
    luxuryBedFoot:  786, // decor layer
    luxuryBedHeadOverlay: 794, // above npc layer
    luxuryBedFootOverlay: 802, // above npc layer

    // Chairs 
    stool:  724,
    stoolDark:    754,
    stoolWithCover:  755,
    stoolWithPurpleCushion: 756,

    // Tables (2×2 minimum top-view - can be tiled to make any size)
    smallTableTopLeft:     717,
    smallTableTopMiddle: 718,
    smallTableTopRight:    719,
    smallTableMiddleLeft:     725,
    smallTableMiddleMiddle: 726,
    smallTableMiddleRight:    727,
    smallTableBottomLeft:  733,
    smallTableBottomMiddle:  734,
    smallTableBottomRight: 735,

    roundTable:            716,
    roundTableWithCloth:            747,

    // Bookshelf / shelf (2 tiles tall)
    bookshelfTop:    715,
    bookshelfBottom: 723,

    // Counter / bar (single tile, top-view)
    counterTop: 691,

    // Desk (single tile)
    deskTop: 746,

    // Fireplace (3 tiles wide, 2 tiles tall)
    fireplaceTopLeft:    832,
    fireplaceTopMiddle:    833,
    fireplaceTopRight:    834,
    fireplaceBottomLeft: 840,
    fireplaceBottomMiddle: 841,
    fireplaceBottomRight: 842,

    // Candles / lighting
    candlestickUnlit:  1002,

    candlestickLitTop:  905,
    candlestickLitBottom:  1003,
    wallTorch:    666,
    floorLantern: 666,

    // Windows (placed in walls) — 4 variants
    windowTop:    592, windowTop2:    593, windowTop3:    594, windowTop4:    595,
    windowBottom: 600, windowBottom2: 601, windowBottom3: 602, windowBottom4: 603,

    // Internal windows - top 596 to 599, bottom 604 to 607


    // Interior doors (2 tiles tall)
    doorTop:    535,
    doorBottom: 543,

    // Stairs
    stairsUp:   666,
    stairsDown: 666,

    // Decorative floor / wall items
    rugTopLeft:     837,
    // mid - 838
    rugTopRight:    839,
    // middle row 845,846,847
    rugBottomLeft:  853,
    // mid 854
    rugBottomRight: 855,
    painting:       666,
    mirrorTop:      629,
    mirrorBottom:   637,

    // Items that are placable on tables, etc
    closedBook: 952,
    openBook: 953,
    blueclosedBook: 954,
    blueopenBook: 955,
    blackclosedBook: 956,
    blackopenBook: 957,
    greenclosedBook: 958,
    greenopenBook: 959,


    // Exterior Walls

    // Wood Wall starts at 352
    woodWallLeftTop:       352, woodWallMiddleTop:    353, woodWallRightTop:    354,
    woodWallPillarTop:     355, woodWallShadowTop:    356,
    woodWallDoorArchTop:   358, woodWallDoorTop:      359,
    woodWallLeftBottom:    360, woodWallMiddleBottom: 361, woodWallRightBottom: 362,
    woodWallPillarBottom:  363, woodWallShadowBottom: 364,
    woodWallDoorBottom:    367,

    // Tudor Frame starts at 368
    tudorFrameLeftTop:       368, tudorFrameMiddleTop:    369, tudorFrameRightTop:    370,
    tudorFramePillarTop:     371, tudorFrameShadowTop:    372,
    tudorFrameDoorArchTop:   374, tudorFrameDoorTop:      375,
    tudorFrameLeftBottom:    376, tudorFrameMiddleBottom: 377, tudorFrameRightBottom: 378,
    tudorFramePillarBottom:  379, tudorFrameShadowBottom: 380,
    tudorFrameDoorBottom:    383,

    // Rendered Brick starts at 384
    renderedBrickLeftTop:       384, renderedBrickMiddleTop:    385, renderedBrickRightTop:    386,
    renderedBrickPillarTop:     387, renderedBrickShadowTop:    388,
    renderedBrickDoorArchTop:   390, renderedBrickDoorTop:      391,
    renderedBrickLeftBottom:    392, renderedBrickMiddleBottom: 393, renderedBrickRightBottom: 394,
    renderedBrickPillarBottom:  395, renderedBrickShadowBottom: 396,
    renderedBrickDoorBottom:    399,

    // Brick starts at 400
    brickLeftTop : 400, // Can be repeated for additional rows to add height
    brickLeftBottom : 408,
    brickMiddleTop : 401,
    brickMiddleBottom : 409,
    brickRightTop : 402,
    brickRightBottom : 410,
    brickPillarTop: 403,
    brickPillarBottom: 411,
    brickShadowTop: 404, // goes to teh right of the pilar for depth
    brickShadowBottom: 412, // goes to teh right of the pilar for depth
    brickDoorArchTop: 406, // Texture behind door decor
    brickDoorTop: 407,
    brickDoorBottom: 415,

    // White Stone - 416
    whiteStoneLeftTop:       416, whiteStoneMiddleTop:    417, whiteStoneRightTop:    418,
    whiteStonePillarTop:     419, whiteStoneShadowTop:    420,
    whiteStoneDoorArchTop:   422, whiteStoneDoorTop:      423,
    whiteStoneLeftBottom:    424, whiteStoneMiddleBottom: 425, whiteStoneRightBottom: 426,
    whiteStonePillarBottom:  427, whiteStoneShadowBottom: 428,
    whiteStoneDoorBottom:    431,

    // Dark Stone - 432
    darkStoneLeftTop:       432, darkStoneMiddleTop:    433, darkStoneRightTop:    434,
    darkStonePillarTop:     435, darkStoneShadowTop:    436,
    darkStoneDoorArchTop:   438, darkStoneDoorTop:      439,
    darkStoneLeftBottom:    440, darkStoneMiddleBottom: 441, darkStoneRightBottom: 442,
    darkStonePillarBottom:  443, darkStoneShadowBottom: 444,
    darkStoneDoorBottom:    447,

    // Castle Stone - 448
    castleStoneLeftTop:       448, castleStoneMiddleTop:    449, castleStoneRightTop:    450,
    castleStonePillarTop:     451, castleStoneShadowTop:    452,
    castleStoneDoorArchTop:   454, castleStoneDoorTop:      455,
    castleStoneLeftBottom:    456, castleStoneMiddleBottom: 457, castleStoneRightBottom: 458,
    castleStonePillarBottom:  459, castleStoneShadowBottom: 460,
    castleStoneDoorBottom:    463,

    // Ornate Stone - 464
    ornateStoneLeftTop:       464, ornateStoneMiddleTop:    465, ornateStoneRightTop:    466,
    ornateStonePillarTop:     467, ornateStoneShadowTop:    468,
    ornateStoneDoorArchTop:   470, ornateStoneDoorTop:      471,
    ornateStoneLeftBottom:    472, ornateStoneMiddleBottom: 473, ornateStoneRightBottom: 474,
    ornateStonePillarBottom:  475, ornateStoneShadowBottom: 476,
    ornateStoneDoorBottom:    479,

    // Reinforced Stone - 480
    reinforcedStoneLeftTop:       480, reinforcedStoneMiddleTop:    481, reinforcedStoneRightTop:    482,
    reinforcedStonePillarTop:     483, reinforcedStoneShadowTop:    484,
    reinforcedStoneDoorArchTop:   486, reinforcedStoneDoorTop:      487,
    reinforcedStoneLeftBottom:    488, reinforcedStoneMiddleBottom: 489, reinforcedStoneRightBottom: 490,
    reinforcedStonePillarBottom:  491, reinforcedStoneShadowBottom: 492,
    reinforcedStoneDoorBottom:    495,

    // Wooden Slats - 496
    woodenSlatsLeftTop:       496, woodenSlatsMiddleTop:    497, woodenSlatsRightTop:    498,
    woodenSlatsPillarTop:     499, woodenSlatsShadowTop:    500,
    woodenSlatsDoorArchTop:   502, woodenSlatsDoorTop:      503,
    woodenSlatsLeftBottom:    504, woodenSlatsMiddleBottom: 505, woodenSlatsRightBottom: 506,
    woodenSlatsPillarBottom:  507, woodenSlatsShadowBottom: 508,
    woodenSlatsDoorBottom:    511,

    // Interior - Stiped Wallpaper - 512

    // Interior - White walls - 528

    // Prison Cell Railings - 544


    // Roofs - 4 rows , repeat for width of building
    woodRoofRow1 : 560,
    woodRoofRow2 : 568,
    woodRoofRow3 : 576,
    woodRoofRow4 : 584,

    yellowSlateRoofRow1 : 561,
    yellowSlateRoofRow2 : 569,
    yellowSlateRoofRow3 : 577,
    yellowSlateRoofRow4 : 585,

    blueSlateRoofRow1: 562,
    blueSlateRoofRow2: 570,
    blueSlateRoofRow3: 578,
    blueSlateRoofRow4: 586,

    redSlateRoofRow1: 563,
    redSlateRoofRow2: 571,
    redSlateRoofRow3: 579,
    redSlateRoofRow4: 587,

    greySlateRoofRow1 : 564,
    greySlateRoofRow2 : 572,
    greySlateRoofRow3 : 580,
    greySlateRoofRow4 : 588,

    metalRoofRow1 : 565,
    metalRoofRow2 : 573,
    metalRoofRow3 : 581,
    metalRoofRow4 : 589,

    strawRoofRow1 : 566,
    strawRoofRow2 : 574,
    strawRoofRow3 : 582,
    strawRoofRow4 : 590,


} as const