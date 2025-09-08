//BC全部動作查詢
function getActionsForPart(part) {
    // 篩選動作
    const actions = window.ActivityFemale3DCG.filter(activity => {
        const targets = activity.Target || [];
        const targetSelf = activity.TargetSelf === true ? activity.Target : (activity.TargetSelf || []);
        return targets.includes(part) || targetSelf.includes(part);
    });

    // 創建結果陣列
    const result = actions.map(activity => {
        let activityName = activity.Name;
        let translatedName = activityName;

        // 處理 XSAct_ 前綴
        if (activityName.startsWith('XSAct_')) {
            translatedName = activityName.replace('XSAct_', ''); // 例如 XSAct_缩脖子 → 缩脖子
        } else {
            // 使用 ActivityDictionaryText 獲取翻譯
            const key = `Label-ChatOther-${part}-${activityName}`;
            if (typeof window.ActivityDictionaryText === 'function') {
                const dictTranslation = window.ActivityDictionaryText(key);
                if (dictTranslation && 
                    !dictTranslation.includes('[STRING_RETRIEVAL_FAILED!!]') && 
                    !dictTranslation.includes('MISSING ACTIVITY DESCRIPTION FOR KEYWORD')) {
                    translatedName = dictTranslation; // 例如 Label-ChatOther-ItemHead-Pet → 摸头
                }
            }
        }

        return {
            Target_Group: part, // 第一個是 Target_Group
            activityName: activityName,
            translatedactivity: translatedName
        };
    });
    return result;
}

// 定義所有 Target_Group 的一維陣列
const TG = [
    "ItemFeet", "ItemLegs", "ItemVulva", "ItemVulvaPiercings", "ItemButt", "ItemPelvis",
    "ItemTorso", "ItemNipples", "ItemBreast", "ItemArms", "ItemHands", "ItemNeck",
    "ItemMouth", "ItemHead", "ItemNose", "ItemHood", "ItemEars", "ItemBoots"
];

// 將所有 Target_Group 的動作整合成一個大陣列
let allActions = [];
TG.forEach(part => {
    const actions = getActionsForPart(part);
    allActions = allActions.concat(actions);
});

console.log('所有部位的動作總數:', allActions.length);
console.log(allActions); // 輸出整合後的大陣列
