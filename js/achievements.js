/* achievements.js — 成就徽章 */
(function () {
  'use strict';
  const JP = window.JP;
  const S = JP.S;

  const learnedWords = () => JP.learnedIds().filter((id) => id.startsWith('w:')).length;
  const learnedKana = () => JP.learnedIds().filter((id) => id[0] === 'h' || id[0] === 'k').length;
  const cleared = (w) => !!S.stamps[w];

  const ACH = [
    { id: 'first', em: '🎌', name: '初次登場', desc: '完成第一個關卡', test: () => S.stats.lessons >= 1 },
    { id: 'kana20', em: '🌸', name: '假名新芽', desc: '學會 20 個假名', test: () => learnedKana() >= 20 },
    { id: 'words25', em: '📗', name: '單字收藏家', desc: '收集 25 個單字', test: () => learnedWords() >= 25 },
    { id: 'words100', em: '📚', name: '單字大富翁', desc: '收集 100 個單字', test: () => learnedWords() >= 100 },
    { id: 'combo10', em: '⚡', name: '連擊達人', desc: '在一次挑戰中連續答對 10 題', test: () => S.stats.bestCombo >= 10 },
    { id: 'perfect', em: '💯', name: '完美主義', desc: '以三顆星、零失誤通過關卡', test: () => S.stats.perfects >= 1 },
    { id: 'streak3', em: '🔥', name: '三天熱身', desc: '連續學習 3 天', test: () => S.bestStreak >= 3 },
    { id: 'streak7', em: '🏮', name: '一週不間斷', desc: '連續學習 7 天', test: () => S.bestStreak >= 7 },
    { id: 'streak30', em: '🗻', name: '堅持一個月', desc: '連續學習 30 天', test: () => S.bestStreak >= 30 },
    { id: 'boss', em: '👹', name: '鬼退治', desc: '打倒第一隻鬼關魔王', test: () => S.stats.bossWins >= 1 },
    { id: 'hira', em: '⛩️', name: '平假名完全制霸', desc: '通關「ひらがな」世界', test: () => cleared('hira') },
    { id: 'kata', em: '🎴', name: '片假名完全制霸', desc: '通關「カタカナ」世界', test: () => cleared('kata') },
    { id: 'n5', em: '🏯', name: 'N5 修了', desc: '通關 N5 的兩個世界', test: () => cleared('n5a') && cleared('n5b') },
    { id: 'n4', em: '🗾', name: '邁向 N4', desc: '通關 N4 世界', test: () => cleared('n4') },
    { id: 'listen50', em: '👂', name: '順風耳', desc: '答對 50 題聽力題', test: () => S.stats.listening >= 50 },
    { id: 'blitz15', em: '⏱️', name: '閃電手', desc: '閃電挑戰答對 15 題以上', test: () => S.stats.blitz >= 15 },
    { id: 'lv5', em: '⭐', name: '等級 5', desc: '升到 Lv 5', test: () => JP.levelInfo().level >= 5 },
    { id: 'lv10', em: '🌟', name: '等級 10', desc: '升到 Lv 10', test: () => JP.levelInfo().level >= 10 },
    { id: 'ans500', em: '🔨', name: '千錘百鍊', desc: '累計答題 500 題', test: () => S.stats.answered >= 500 },
  ];

  function checkAch() {
    const fresh = [];
    ACH.forEach((a) => {
      if (!S.ach[a.id] && a.test()) { S.ach[a.id] = JP.dayKey(); fresh.push(a); }
    });
    if (fresh.length) JP.save();
    return fresh;
  }

  JP.ACH = ACH;
  JP.checkAch = checkAch;
})();
