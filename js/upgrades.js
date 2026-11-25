// SINGULARIS — Synergistic Quantum Augmentations & Upgrade Pool
window.SG = window.SG || {};

(function (SG) {
  'use strict';

  const UPGRADES = [
    {
      id: 'slingshot_mastery',
      title: 'Гравитационная Праща',
      tag: 'ОРБИТАЛЬНАЯ ФИЗИКА',
      icon: 'SLG',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'Снаряды, ускоренные сингулярностью, получают +75% урона, +2 пробития насквозь и взрывной импульс.',
      apply(mods) {
        mods.slingshotMult += 0.75;
        mods.slingshotPierce += 2;
      }
    },
    {
      id: 'binary_stars',
      title: 'Бинарная Система',
      tag: 'СИНГУЛЯРНОСТЬ',
      icon: 'BIN',
      rarity: 'legendary',
      maxStacks: 2,
      desc: '+1 одновременная сингулярность. Между парными черными дырами возникает плазменный грави-мост, режущий врагов!',
      apply(mods) {
        mods.maxWells += 1;
        mods.binaryBridge += 1;
      }
    },
    {
      id: 'hawking_burn',
      title: 'Излучение Хокинга',
      tag: 'СИНГУЛЯРНОСТЬ',
      icon: 'HWK',
      rarity: 'rare',
      maxStacks: 3,
      desc: 'Горизонт событий сжигает врагов внутри воронки (48 ед./сек за уровень) и расширяет радиус захвата на +18%.',
      apply(mods) {
        mods.hawkingDps += 48;
        mods.wellRadiusMult += 0.18;
      }
    },
    {
      id: 'kinetic_hijack',
      title: 'Захват Импульса',
      tag: 'КОНТРАТАКА',
      icon: 'HIJ',
      rarity: 'legendary',
      maxStacks: 2,
      desc: 'Искривленные вашей гравитацией вражеские пули становятся золотыми, наносят 300% урона врагам и чинят ваш щит!',
      apply(mods) {
        mods.hijackMult += 1.5;
        mods.hijackShieldHeal += 6;
      }
    },
    {
      id: 'split_prism',
      title: 'Квантовый Мультиплет',
      tag: 'ОРУДИЕ',
      icon: 'TRI',
      rarity: 'epic',
      maxStacks: 3,
      desc: '+2 дополнительных снаряда веером при каждом выстреле. Идеально фокусируются черной дырой в единый луч!',
      apply(mods) {
        mods.multishot += 2;
      }
    },
    {
      id: 'ricochet_prism',
      title: 'Призма Рикошета',
      tag: 'ОРУДИЕ',
      icon: 'PRM',
      rarity: 'rare',
      maxStacks: 3,
      desc: '+2 рикошета от стен арены и щитов. При отскоке снаряд доворачивает в сторону ближайшего врага (+20% урона).',
      apply(mods) {
        mods.bounces += 2;
        mods.damageMult += 0.2;
      }
    },
    {
      id: 'tesla_chain',
      title: 'Резонансная Дуга',
      tag: 'СИНЕРГИЯ',
      icon: 'ARC',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'Ускоренные или критические попадания бьют цепной молнией по соседним целям в радиусе 185px.',
      apply(mods) {
        mods.chainTargets += 2;
        mods.chainDamage += 0.45;
      }
    },
    {
      id: 'supernova_collapse',
      title: 'Коллапс Сверхновой',
      tag: 'ДЕТОНАЦИЯ [E]',
      icon: 'SNV',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'При закрытии или взрыве [E] сингулярность детонирует сверхновой, нанося огромный урон по площади, оглушает врагов и снижает КД взрыва [E] на 12%.',
      apply(mods) {
        mods.supernovaDamage += 115;
        mods.detonateCdMult *= 0.88;
      }
    },
    {
      id: 'paradox_clone',
      title: 'Парадоксальный Двойник',
      tag: 'ХРОНО-МЕХАНИКА [Q]',
      icon: 'ECH',
      rarity: 'legendary',
      maxStacks: 2,
      desc: 'Перемотка времени [Q] оставляет голографического клона на 6 сек., который ведет шквальный огонь по врагам, и снижает КД на 25%.',
      apply(mods) {
        mods.paradoxClone += 1;
        mods.rewindCdMult *= 0.75;
      }
    },
    {
      id: 'lagrange_drones',
      title: 'Спутники Лагранжа',
      tag: 'ОРБИТАЛЬНАЯ ЗАЩИТА',
      icon: 'DRN',
      rarity: 'rare',
      maxStacks: 3,
      desc: '+2 плазменных спутника на орбите корабля: перехватывают вражеские снаряды и режут врагов в ближнем бою.',
      apply(mods, player) {
        mods.drones += 2;
        if (player) player.rebuildDrones();
      }
    },
    {
      id: 'chrono_reactor',
      title: 'Тахионный Реактор',
      tag: 'ХРОНО-МЕХАНИКА',
      icon: 'TAC',
      rarity: 'common',
      maxStacks: 3,
      desc: '+45% регенерации Хроно-Энергии, +25% скорости корабля и +25% скорострельности во время замедления времени!',
      apply(mods) {
        mods.chronoRegenMult += 0.45;
        mods.moveSpeedMult += 0.22;
        mods.bulletTimeFireBoost += 0.28;
      }
    },
    {
      id: 'annihilation_harvest',
      title: 'Аннигиляция Материи',
      tag: 'ВАМПИРИЗМ',
      icon: 'VMP',
      rarity: 'rare',
      maxStacks: 3,
      desc: 'Столкновение врагов друг с другом в вашей гравитации наносит +90% урона и восстанавливает корпус и щит.',
      apply(mods) {
        mods.collisionMult += 0.9;
        mods.vampOnKill += 3.5;
      }
    },
    {
      id: 'rail_caliber',
      title: 'Релятивистский Калибр',
      tag: 'ОРУДИЕ',
      icon: 'RLG',
      rarity: 'common',
      maxStacks: 4,
      desc: '+32% базового урона орудия, +22% скорости полета снарядов и микро-искривление сетки при попадании.',
      apply(mods) {
        mods.damageMult += 0.32;
        mods.projSpeedMult += 0.22;
      }
    },
    {
      id: 'dilation_halo',
      title: 'Ореол Дилатации',
      tag: 'ЗАЩИТА',
      icon: 'DIL',
      rarity: 'rare',
      maxStacks: 2,
      desc: '+35 к макс. щиту. Вражеские пули в радиусе 145px вокруг корабля вязнут во времени (скорость -42%).',
      apply(mods, player) {
        mods.dilationAura += 0.42;
        if (player) {
          player.maxShield += 35;
          player.shield = Math.min(player.maxShield, player.shield + 35);
        }
      }
    },
    {
      id: 'aura_corona',
      title: 'Плазменная Корона',
      tag: 'АУРА',
      icon: 'COR',
      rarity: 'rare',
      maxStacks: 3,
      desc: 'Вокруг корабля пылает огненная корона (122px+), сжигая ближайших врагов на 38 ед./сек за уровень.',
      apply(mods) {
        mods.coronaDps += 38;
        mods.coronaRadius = mods.coronaRadius ? mods.coronaRadius + 26 : 122;
      }
    },
    {
      id: 'aura_storm',
      title: 'Грозовой Ореол',
      tag: 'АУРА',
      icon: 'STM',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'Аура раз в 0.8с бьет цепными разрядами молний по врагам в радиусе 178px+ (урон растет с уровнем).',
      apply(mods) {
        mods.stormLevel += 1;
        mods.stormRadius = mods.stormRadius ? mods.stormRadius + 24 : 178;
      }
    },
    {
      id: 'aura_cryo',
      title: 'Крио-Стазис',
      tag: 'АУРА',
      icon: 'CRY',
      rarity: 'rare',
      maxStacks: 3,
      desc: 'Ледяное поле (158px+) замедляет врагов на 24% и увеличивает входящий по ним урон на +22% за уровень.',
      apply(mods) {
        mods.cryoSlow = Math.min(0.68, mods.cryoSlow + 0.24);
        mods.cryoVuln += 0.22;
        mods.cryoRadius = mods.cryoRadius ? mods.cryoRadius + 24 : 158;
      }
    },
    {
      id: 'aura_repulse',
      title: 'Грави-Мантия',
      tag: 'АУРА',
      icon: 'RPL',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'Личное поле отклонения (132px+) плавно отгибает летящие в корабль пули и отталкивает врагов импульсом.',
      apply(mods) {
        mods.repulseAura += 1;
        mods.repulseRadius = mods.repulseRadius ? mods.repulseRadius + 22 : 132;
      }
    },
    {
      id: 'aura_entropy',
      title: 'Поле Энтропии',
      tag: 'АУРА',
      icon: 'ENT',
      rarity: 'legendary',
      maxStacks: 2,
      desc: 'Вытягивает энергию из врагов в радиусе 152px+ (26 ед./сек), напрямую восстанавливая ваш щит и корпус.',
      apply(mods) {
        mods.entropyDps += 26;
        mods.entropyRadius = mods.entropyRadius ? mods.entropyRadius + 28 : 152;
      }
    },
    {
      id: 'aura_magnet',
      title: 'Гравитационный Магнит',
      tag: 'АУРА',
      icon: 'MAG',
      rarity: 'common',
      maxStacks: 3,
      desc: '+135px к радиусу сбора кристаллов опыта и -16% перезарядки установки сингулярностей [ПКМ].',
      apply(mods) {
        mods.pickupRadiusBonus += 135;
        mods.wellCdMult *= 0.84;
      }
    },
    {
      id: 'gravity_mastery',
      title: 'Резонанс Горизонта',
      tag: 'СИНГУЛЯРНОСТЬ',
      icon: 'GRV',
      rarity: 'epic',
      maxStacks: 3,
      desc: '+35% к силе искривления всех пуль и врагов вокруг дыр, +2.2с длительности дыр и -15% КД [ПКМ].',
      apply(mods) {
        mods.wellGravMult += 0.35;
        mods.wellLifeBonus += 2.2;
        mods.wellCdMult *= 0.85;
      }
    },
    {
      id: 'overclock_core',
      title: 'Сверхпроводимость',
      tag: 'ОРУДИЕ',
      icon: 'OVC',
      rarity: 'common',
      maxStacks: 4,
      desc: '+22% к скорострельности главного калибра и +14% шанс критического выстрела (2× урон).',
      apply(mods) {
        mods.fireRateMult += 0.22;
        mods.critChance = Math.max(mods.critChance, Math.min(0.90, mods.critChance + 0.14));
      }
    },
    {
      id: 'singularity_shards',
      title: 'Осколки Горизонта',
      tag: 'СИНЕРГИЯ',
      icon: 'SHD',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'Уничтоженные в ауре или гравитации враги распадаются на залп плазменных осколков, изгибающихся в дырах.',
      apply(mods) {
        mods.shardBurst += 2;
      }
    },
    {
      id: 'tank_hull',
      title: 'Титановая Оболочка',
      tag: 'ТАНК',
      icon: 'HUL',
      rarity: 'common',
      maxStacks: 4,
      desc: '+45 к макс. прочности корпуса (мгновенно лечит) и +12% к броне, снижающей весь входящий урон.',
      apply(mods, player) {
        mods.armor = Math.max(mods.armor, Math.min(0.75, mods.armor + 0.12));
        if (player) {
          player.maxHp += 45;
          player.hp = Math.min(player.maxHp, player.hp + 45);
        }
      }
    },
    {
      id: 'tank_regen',
      title: 'Нано-Регенерация',
      tag: 'ТАНК',
      icon: 'REG',
      rarity: 'common',
      maxStacks: 3,
      desc: '+3.5 HP/сек постоянной регенерации корпуса и +45% к скорости восстановления щита.',
      apply(mods) {
        mods.hpRegen += 3.5;
        mods.shieldRegenMult += 0.45;
      }
    },
    {
      id: 'tank_thorns',
      title: 'Реактивная Броня',
      tag: 'ТАНК',
      icon: 'THN',
      rarity: 'rare',
      maxStacks: 3,
      desc: 'При получении урона бьет волной (185px) на 95 + 35% от макс. HP, сжигая вражеские пули рядом.',
      apply(mods) {
        mods.thornsLevel += 1;
      }
    },
    {
      id: 'tank_ram',
      title: 'Кинетический Таран',
      tag: 'ТАНК',
      icon: 'RAM',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'Таран врагов наносит им 65×ур + 45% макс. HP урона, отбрасывает их и режет контактный урон по вам.',
      apply(mods) {
        mods.ramLevel += 1;
      }
    },
    {
      id: 'tank_aegis',
      title: 'Квантовый Бастион',
      tag: 'ТАНК',
      icon: 'AEG',
      rarity: 'legendary',
      maxStacks: 2,
      desc: '+55 макс. щита. При пробитии щита замораживает всех врагов в радиусе 260px на 2.2с и дает неуязвимость (КД 10с).',
      apply(mods, player) {
        mods.aegisBlast += 1;
        if (player) {
          player.maxShield += 55;
          player.shield = Math.min(player.maxShield, player.shield + 55);
        }
      }
    },
    {
      id: 'tank_fortress',
      title: 'Фортификация Ядра',
      tag: 'ТАНК',
      icon: 'FRT',
      rarity: 'epic',
      maxStacks: 2,
      desc: 'Выше 70% HP все ваши ауры бьют на +45% сильнее; ниже 50% HP получаете на 25% меньше урона.',
      apply(mods) {
        mods.fortressLevel += 1;
      }
    },
    {
      id: 'orbit_trap',
      title: 'Орбитальная Ловушка',
      tag: 'ОРБИТА',
      icon: 'TRP',
      rarity: 'legendary',
      maxStacks: 3,
      desc: 'Черные дыры захватывают ваши и вражеские пули на орбиту (до 14×ур шт.). При закрытии/взрыве [E] дыры залп разом летит во врагов!',
      apply(mods) {
        mods.orbitTrap += 1;
      }
    },
    {
      id: 'orbit_collider',
      title: 'Коллайдер Орбит',
      tag: 'ОРБИТА',
      icon: 'CLD',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'Захваченные пули на орбите набирают +55% урона за секунду вращения (до 4×), получают пробитие и шинкуют врагов в кольце.',
      apply(mods) {
        mods.orbitCollider += 1;
      }
    },
    {
      id: 'hyper_gravity',
      title: 'Сверхмассивный Коллапс',
      tag: 'СИНГУЛЯРНОСТЬ',
      icon: 'HYP',
      rarity: 'epic',
      maxStacks: 3,
      desc: '+65% к силе гравитационного искажения пуль и притяжения врагов, +22% к радиусу дыр.',
      apply(mods) {
        mods.wellGravMult += 0.65;
        mods.wellRadiusMult += 0.22;
      }
    },
    {
      id: 'tidal_vortex',
      title: 'Грави-Водоворот',
      tag: 'СИНГУЛЯРНОСТЬ',
      icon: 'VTX',
      rarity: 'rare',
      maxStacks: 2,
      desc: 'Черные дыры раскручивают врагов по спирали, многократно ускоряя их столкновения и аннигиляцию.',
      apply(mods) {
        mods.tidalVortex += 1;
      }
    },
    {
      id: 'well_haste',
      title: 'Двойная Инжекция',
      tag: 'СИНГУЛЯРНОСТЬ',
      icon: 'HST',
      rarity: 'common',
      maxStacks: 3,
      desc: '-22% к перезарядке установки дыр [ПКМ] и -20% к перезарядке взрыва Сверхновой [E].',
      apply(mods) {
        mods.wellCdMult *= 0.78;
        mods.detonateCdMult *= 0.80;
      }
    },
    {
      id: 'aura_mastery',
      title: 'Резонатор Аур',
      tag: 'АУРА',
      icon: 'AMP',
      rarity: 'rare',
      maxStacks: 4,
      desc: '+24% к радиусу и +35% к урону и силе ВСЕХ активных аур корабля.',
      apply(mods) {
        mods.auraRadiusMult += 0.24;
        mods.auraDpsMult += 0.35;
      }
    },
    {
      id: 'aura_nova',
      title: 'Пульсирующая Нова',
      tag: 'АУРА',
      icon: 'NVA',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'Каждые ~2.8с аура испускает расширяющуюся плазменную волну (210px+), отбрасывающую и сжигающую врагов.',
      apply(mods) {
        mods.novaLevel += 1;
        mods.novaRadius = mods.novaRadius ? mods.novaRadius + 28 : 210;
      }
    },
    {
      id: 'aura_radiation',
      title: 'Аура Распада',
      tag: 'АУРА',
      icon: 'RAD',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'Накладывает на врагов в радиусе (165px+) нарастающие стаки распада (+14 DPS за стак) — расплавляет боссов!',
      apply(mods) {
        mods.radLevel += 1;
        mods.radRadius = mods.radRadius ? mods.radRadius + 25 : 165;
      }
    },
    {
      id: 'drone_turrets',
      title: 'Дроны-Перехватчики',
      tag: 'ОРБИТАЛЬНАЯ ЗАЩИТА',
      icon: 'TRT',
      rarity: 'epic',
      maxStacks: 3,
      desc: '+1 спутник Лагранжа. Все спутники автоматически стреляют плазмой по врагам и вращаются на 35% быстрее.',
      apply(mods, player) {
        mods.drones += 1;
        mods.droneTurrets += 1;
        if (player) player.rebuildDrones();
      }
    },
    {
      id: 'berserk_core',
      title: 'Берсерк Реактора',
      tag: 'СИНЕРГИЯ',
      icon: 'BRS',
      rarity: 'rare',
      maxStacks: 2,
      desc: 'Чем ниже ваш щит и корпус, тем выше скорострельность (до +100%) и скорость корабля (до +45%).',
      apply(mods) {
        mods.berserkLevel += 1;
      }
    },
    {
      id: 'chrono_kill',
      title: 'Каскад Времени',
      tag: 'ХРОНО-МЕХАНИКА',
      icon: 'CSC',
      rarity: 'rare',
      maxStacks: 3,
      desc: 'Каждое убийство восстанавливает +8 Хроно-энергии и сокращает текущие КД [Q] и [E] на 0.25с за уровень.',
      apply(mods) {
        mods.chronoOnKill += 1;
      }
    },
    {
      id: 'scatter_cannon',
      title: 'Плазменный Дробовик',
      tag: 'ОРУДИЕ',
      icon: 'SCT',
      rarity: 'epic',
      maxStacks: 2,
      desc: '+3 снаряда в широком веере при выстреле. Заряжает Орбитальную Ловушку за пару залпов!',
      apply(mods) {
        mods.multishot += 3;
        mods.spreadBonus += 0.05;
      }
    },
    {
      id: 'crit_nova',
      title: 'Критический Резонанс',
      tag: 'ОРУДИЕ',
      icon: 'CRT',
      rarity: 'rare',
      maxStacks: 3,
      desc: '+12% шанс крита. Критические попадания взрываются в радиусе 68px (45% урона) и чинят +2 щита.',
      apply(mods) {
        mods.critChance = Math.min(0.9, mods.critChance + 0.12);
        mods.critNova += 1;
      }
    },

    // ===== +10 NEW AURAS (43..52) =====
    {
      id: 'aura_beam',
      title: 'Квантовый Луч',
      tag: 'АУРА',
      icon: 'BEM',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'Аура непрерывного плазменного луча сжигает ближайшего врага в радиусе 220px и замедляет его.',
      apply(mods) {
        mods.beamLevel += 1;
        mods.beamRadius = Math.max(mods.beamRadius, 220) + (mods.beamLevel > 1 ? 35 : 0);
      }
    },
    {
      id: 'aura_vortex_pull',
      title: 'Аура Притяжения',
      tag: 'АУРА',
      icon: 'VPL',
      rarity: 'rare',
      maxStacks: 3,
      desc: 'Магнитное поле 210px мягко подтягивает врагов в зоны других ваших аур (+60px радиус за стек).',
      apply(mods) {
        mods.vortexPullLevel += 1;
        mods.vortexPullRadius = Math.max(mods.vortexPullRadius, 210) + (mods.vortexPullLevel > 1 ? 60 : 0);
      }
    },
    {
      id: 'aura_emp',
      title: 'ЭМИ-Поле',
      tag: 'АУРА',
      icon: 'EMP',
      rarity: 'rare',
      maxStacks: 3,
      desc: 'Каждые 3.5 сек ЭМИ-импульс (160px) оглушает врагов на 0.7с и сбивает вражеские снаряды.',
      apply(mods) {
        mods.empLevel += 1;
        mods.empRadius = Math.max(mods.empRadius, 160) + (mods.empLevel > 1 ? 25 : 0);
      }
    },
    {
      id: 'aura_sanctuary',
      title: 'Аура Святилища',
      tag: 'АУРА',
      icon: 'SNC',
      rarity: 'rare',
      maxStacks: 3,
      desc: 'Усиливает регенерацию щита на +6/сек, когда в радиусе 190px нет врагов.',
      apply(mods) {
        mods.sanctuaryLevel += 1;
      }
    },
    {
      id: 'aura_thermal_shock',
      title: 'Термошок',
      tag: 'АУРА',
      icon: 'THS',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'Враги под одновременным действием Короны и Крио получают +120% урона от плазменного термошока.',
      apply(mods) {
        mods.thermalShock += 1;
      }
    },
    {
      id: 'aura_antimatter',
      title: 'Бастион Антиматерии',
      tag: 'АУРА',
      icon: 'ANT',
      rarity: 'legendary',
      maxStacks: 2,
      desc: 'Антиматерийный барьер 115px аннигилирует слабые вражеские пули при касании (перезарядка 1.2с).',
      apply(mods) {
        mods.antimatterLevel += 1;
        mods.antimatterRadius = Math.max(mods.antimatterRadius, 115) + (mods.antimatterLevel > 1 ? 25 : 0);
      }
    },
    {
      id: 'aura_overcharge',
      title: 'Перегрузка Полей',
      tag: 'АУРА',
      icon: 'OVR',
      rarity: 'epic',
      maxStacks: 3,
      desc: '+45% к урону всех аур и +12% к их радиусу действия.',
      apply(mods) {
        mods.auraDpsMult += 0.45;
        mods.auraRadiusMult += 0.12;
      }
    },
    {
      id: 'aura_gravity_well',
      title: 'Карманная Дыра',
      tag: 'АУРА',
      icon: 'PKT',
      rarity: 'legendary',
      maxStacks: 2,
      desc: 'Искривляет все вражеские пули в радиусе 180px вокруг корабля в обход вашей траектории.',
      apply(mods) {
        mods.pocketHoleLevel += 1;
      }
    },
    {
      id: 'aura_resonance_echo',
      title: 'Резонансное Эхо',
      tag: 'АУРА',
      icon: 'REC',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'Молнии Штормовой Спирали и Кольца Тесла с вероятностью 40% бьют дополнительный раз.',
      apply(mods) {
        mods.resonanceEcho += 1;
      }
    },
    {
      id: 'aura_solar_flare',
      title: 'Солнечная Вспышка',
      tag: 'АУРА',
      icon: 'FLR',
      rarity: 'rare',
      maxStacks: 3,
      desc: 'Каждые 4.5 сек выпускает огненное кольцо (220px), поджигающее всех задетых врагов.',
      apply(mods) {
        mods.solarFlareLevel += 1;
      }
    },

    // ===== +12 NEW TANK & DEFENSE (53..64) =====
    {
      id: 'tank_phoenix',
      title: 'Протокол Феникс',
      tag: 'ТАНК',
      icon: 'PHX',
      rarity: 'legendary',
      maxStacks: 2,
      desc: 'При смертельном уроне воскрешает корабль с 60% HP, 100% щита и сжигает врагов вокруг (+1 заряд за уровень).',
      apply(mods) {
        mods.phoenixCharges += 1;
      }
    },
    {
      id: 'tank_phase_dodge',
      title: 'Квантовое Уклонение',
      tag: 'ЗАЩИТА',
      icon: 'DDG',
      rarity: 'rare',
      maxStacks: 4,
      desc: '+11% шанс полностью уйти в фазовый сдвиг и проигнорировать входящий урон.',
      apply(mods) {
        mods.dodgeChance = Math.min(0.6, mods.dodgeChance + 0.11);
      }
    },
    {
      id: 'tank_juggernaut',
      title: 'Сверхтяжелый Реактор',
      tag: 'ТАНК',
      icon: 'JUG',
      rarity: 'epic',
      maxStacks: 3,
      desc: '+70 макс. HP (и текущее HP), но -6% к скорости движения. Скейлит урон Шипов и Тарана.',
      apply(mods, player) {
        mods.moveSpeedMult = Math.max(0.65, mods.moveSpeedMult - 0.06);
        if (player) {
          player.maxHp += 70;
          player.hp = Math.min(player.maxHp, player.hp + 70);
        }
      }
    },
    {
      id: 'tank_shield_capacitor',
      title: 'Емкостный Конденсатор',
      tag: 'ЗАЩИТА',
      icon: 'CAP',
      rarity: 'common',
      maxStacks: 5,
      desc: '+45 к максимуму щита и мгновенно восстанавливает +45 щита.',
      apply(mods, player) {
        if (player) {
          player.maxShield += 45;
          player.shield = Math.min(player.maxShield, player.shield + 45);
        }
      }
    },
    {
      id: 'tank_xp_siphon',
      title: 'Квантовая Конверсия',
      tag: 'ВАМПИРИЗМ',
      icon: 'XPH',
      rarity: 'rare',
      maxStacks: 3,
      desc: 'Каждый собранный кристалл XP восстанавливает +1.5 HP корпуса и +2 щита.',
      apply(mods) {
        mods.xpHeal += 1.5;
      }
    },
    {
      id: 'tank_white_medic',
      title: 'Биосинтез Белой Дыры',
      tag: 'ТАНК',
      icon: 'WMD',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'Белая Дыра лечит игрока внутри радиуса на +7 HP/сек и чинит +8 щита/сек.',
      apply(mods) {
        mods.whiteMedic += 1;
      }
    },
    {
      id: 'tank_adaptive_plate',
      title: 'Адаптивная Броня',
      tag: 'ЗАЩИТА',
      icon: 'ADP',
      rarity: 'rare',
      maxStacks: 3,
      desc: 'После получения урона включает временную матрицу на 2.5с: +30% к броне.',
      apply(mods) {
        mods.adaptiveArmor += 1;
      }
    },
    {
      id: 'tank_corpse_shield',
      title: 'Жнец Щитов',
      tag: 'ВАМПИРИЗМ',
      icon: 'SHK',
      rarity: 'rare',
      maxStacks: 4,
      desc: 'Каждое убийство врага мгновенно восстанавливает +3 ед. щита.',
      apply(mods) {
        mods.shieldOnKill += 3;
      }
    },
    {
      id: 'tank_bulkhead',
      title: 'Слоистая Обшивка',
      tag: 'ТАНК',
      icon: 'BLK',
      rarity: 'common',
      maxStacks: 5,
      desc: '+10% снижение всего урона и +20 макс. HP.',
      apply(mods, player) {
        mods.armor = Math.min(0.75, mods.armor + 0.1);
        if (player) {
          player.maxHp += 20;
          player.hp = Math.min(player.maxHp, player.hp + 20);
        }
      }
    },
    {
      id: 'tank_bullet_eater',
      title: 'Поглотитель Пуль',
      tag: 'ТАНК',
      icon: 'EAT',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'Когда Черная Дыра поглощает вражескую пулю, корабль лечит +2 HP и +3 щита.',
      apply(mods) {
        mods.bulletEater += 1;
      }
    },
    {
      id: 'tank_static_barrier',
      title: 'Статический Щит',
      tag: 'ЗАЩИТА',
      icon: 'STB',
      rarity: 'common',
      maxStacks: 4,
      desc: '+22% скорость зарядки щитов и +8% скорость полета при полном щите.',
      apply(mods) {
        mods.shieldRegenMult += 0.22;
        mods.staticBarrier += 1;
      }
    },
    {
      id: 'tank_leech_nova',
      title: 'Алая Вспышка',
      tag: 'ВАМПИРИЗМ',
      icon: 'VLN',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'За каждые 30 единиц вылеченного HP выпускает взрыв вампиризма, ранящий врагов в 180px.',
      apply(mods) {
        mods.leechNova += 1;
      }
    },

    // ===== +12 NEW ORBIT & SINGULARITY (65..76) =====
    {
      id: 'orbit_mega_cap',
      title: 'Орбитальный Рой',
      tag: 'ОРБИТА',
      icon: 'SAT',
      rarity: 'rare',
      maxStacks: 3,
      desc: '+12 к максимальной емкости захваченных пуль в каждой Черной Дыре и +25% скорость их вращения.',
      apply(mods) {
        mods.orbitCapBonus += 12;
      }
    },
    {
      id: 'orbit_turret_sparks',
      title: 'Синхро-Разряд',
      tag: 'ОРБИТА',
      icon: 'OSP',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'Орбитальные пули внутри дыры периодически стреляют мини-искрами во врагов поблизости.',
      apply(mods) {
        mods.orbitSparks += 1;
      }
    },
    {
      id: 'orbit_auto_well',
      title: 'Гравитационный Авто-Маяк',
      tag: 'СИНГУЛЯРНОСТЬ',
      icon: 'ATW',
      rarity: 'legendary',
      maxStacks: 2,
      desc: 'Каждые 7 сек автоматически создает дополнительную Черную Дыру в самом плотном скоплении врагов.',
      apply(mods) {
        mods.autoWellLevel += 1;
      }
    },
    {
      id: 'orbit_event_crush',
      title: 'Раздавливание Горизонта',
      tag: 'СИНГУЛЯРНОСТЬ',
      icon: 'CRS',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'Враги в ядре Черной Дыры теряют +3% от максимального HP в секунду от приливного разрыва.',
      apply(mods) {
        mods.eventCrushPct += 0.03;
      }
    },
    {
      id: 'orbit_long_horizon',
      title: 'Вечный Горизонт',
      tag: 'СИНГУЛЯРНОСТЬ',
      icon: 'HOR',
      rarity: 'common',
      maxStacks: 4,
      desc: '+3.0 сек к длительности жизни всех дыр и +14% к их радиусу захвата.',
      apply(mods) {
        mods.wellLifeBonus += 3.0;
        mods.wellRadiusMult += 0.14;
      }
    },
    {
      id: 'orbit_xp_magnet',
      title: 'Вакуумный Сборщик',
      tag: 'ОРБИТАЛЬНАЯ ФИЗИКА',
      icon: 'WXP',
      rarity: 'common',
      maxStacks: 3,
      desc: 'Черные Дыры мощно притягивают к себе XP-кристаллы и телепортируют собранное прямо вам.',
      apply(mods) {
        mods.wellXpVacuum += 1;
      }
    },
    {
      id: 'orbit_twin_detonate',
      title: 'Цепной Коллапс',
      tag: 'ДЕТОНАЦИЯ [E]',
      icon: 'CSD',
      rarity: 'epic',
      maxStacks: 2,
      desc: 'Взрыв сингулярности [E] с вероятностью 55% оставляет после себя микро-дыру на 2.5с.',
      apply(mods) {
        mods.cascadeWell += 1;
      }
    },
    {
      id: 'orbit_slingshot_crit',
      title: 'Праща Сверхновой',
      tag: 'ОРБИТАЛЬНАЯ ФИЗИКА',
      icon: 'SCR',
      rarity: 'rare',
      maxStacks: 3,
      desc: 'Все снаряды, прошедшие через гравитационную пращу, получают гарантированный КРИТ-модификатор.',
      apply(mods) {
        mods.slingshotCrit = 1;
      }
    },
    {
      id: 'orbit_well_heal',
      title: 'Сингулярный Сифон',
      tag: 'ОРБИТА',
      icon: 'WSF',
      rarity: 'rare',
      maxStacks: 3,
      desc: 'При залпе накопленных орбитальных пуль восстанавливает +2 щита за каждую выпущенную пулю.',
      apply(mods) {
        mods.orbitReleaseHeal += 2;
      }
    },
    {
      id: 'orbit_white_nova',
      title: 'Пульсар Отталкивания',
      tag: 'СИНГУЛЯРНОСТЬ',
      icon: 'WHN',
      rarity: 'rare',
      maxStacks: 3,
      desc: 'Белая Дыра отбрасывает вражеские пули с удвоенной скоростью, превращая их в самонаводящиеся.',
      apply(mods) {
        mods.whiteNova += 1;
      }
    },
    {
      id: 'orbit_dark_matter',
      title: 'Темная Материя',
      tag: 'СИНГУЛЯРНОСТЬ',
      icon: 'DMG',
      rarity: 'epic',
      maxStacks: 3,
      desc: '+16% к урону игрока за каждую активную Черную или Белую дыру на арене.',
      apply(mods) {
        mods.darkMatterMult += 0.16;
      }
    },
    {
      id: 'orbit_zero_drag',
      title: 'Безграничная Орбита',
      tag: 'ОРБИТА',
      icon: 'ZDR',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'Выпущенные из орбитального захвата снаряды получают +45% урона и пробивают насквозь.',
      apply(mods) {
        mods.orbitReleaseMult += 0.45;
      }
    },

    // ===== +14 NEW WEAPONS & BALLISTICS (77..90) =====
    {
      id: 'wpn_homing',
      title: 'Векторное Наведение',
      tag: 'ОРУДИЕ',
      icon: 'HOM',
      rarity: 'rare',
      maxStacks: 3,
      desc: 'Плазменные снаряды слегка доворачивают на ближайшего врага в полете.',
      apply(mods) {
        mods.homingStrength += 1;
      }
    },
    {
      id: 'wpn_splash',
      title: 'Плазменные Осколки',
      tag: 'ОРУДИЕ',
      icon: 'SPL',
      rarity: 'rare',
      maxStacks: 3,
      desc: 'Попадания основного калибра взрываются плазмой в радиусе 50px (+18px за стек).',
      apply(mods) {
        mods.splashLevel += 1;
      }
    },
    {
      id: 'wpn_ignite',
      title: 'Зажигательные Заряды',
      tag: 'ОРУДИЕ',
      icon: 'IGN',
      rarity: 'common',
      maxStacks: 4,
      desc: 'Пули поджигают врагов на 3 сек, нанося доп. урон огнем каждую секунду.',
      apply(mods) {
        mods.igniteLevel += 1;
      }
    },
    {
      id: 'wpn_frost_rounds',
      title: 'Крио-Снаряды',
      tag: 'ОРУДИЕ',
      icon: 'FRZ',
      rarity: 'rare',
      maxStacks: 3,
      desc: 'Попадания охлаждают и замедляют врагов на 35% на 2 сек.',
      apply(mods) {
        mods.frostRounds += 1;
      }
    },
    {
      id: 'wpn_rear_gun',
      title: 'Кормовой Излучатель',
      tag: 'ОРУДИЕ',
      icon: 'RER',
      rarity: 'common',
      maxStacks: 3,
      desc: 'При каждом выстреле запускает 1-3 дополнительных импульса точно назад.',
      apply(mods) {
        mods.rearGuns += 1;
      }
    },
    {
      id: 'wpn_side_guns',
      title: 'Бортовые Турели',
      tag: 'ОРУДИЕ',
      icon: 'SID',
      rarity: 'rare',
      maxStacks: 2,
      desc: 'Добавляет залпы по левому и правому бортам корабля (-10% базовый разброс).',
      apply(mods) {
        mods.sideGuns += 1;
      }
    },
    {
      id: 'wpn_burst_echo',
      title: 'Сингулярное Эхо',
      tag: 'ОРУДИЕ',
      icon: 'BEH',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'Каждый 4-й выстрел выпускает мощный удвоенный усиленный заряд (+85% урона).',
      apply(mods) {
        mods.burstEcho += 1;
      }
    },
    {
      id: 'wpn_pierce_lance',
      title: 'Пробивное Копье',
      tag: 'ОРУДИЕ',
      icon: 'PRC',
      rarity: 'rare',
      maxStacks: 4,
      desc: 'Базовые снаряды пробивают +2 цели насквозь, +12% скорости полета.',
      apply(mods) {
        mods.basePierce += 2;
        mods.projSpeedMult += 0.12;
      }
    },
    {
      id: 'wpn_sniper_range',
      title: 'Гиперзвуковой Ствол',
      tag: 'ОРУДИЕ',
      icon: 'RNG',
      rarity: 'common',
      maxStacks: 4,
      desc: '+28% скорость снарядов и +20% дальность/время жизни пули.',
      apply(mods) {
        mods.projSpeedMult += 0.28;
        mods.bulletLifeMult += 0.2;
      }
    },
    {
      id: 'wpn_boss_killer',
      title: 'Разрушитель Титанов',
      tag: 'ОРУДИЕ',
      icon: 'BSK',
      rarity: 'epic',
      maxStacks: 3,
      desc: '+45% урона по боссам и тяжелым врагам (Фалангам).',
      apply(mods) {
        mods.bossDamageBonus += 0.45;
      }
    },
    {
      id: 'wpn_execute',
      title: 'Протокол Казнь',
      tag: 'ОРУДИЕ',
      icon: 'EXE',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'Мгновенно добивает обычных врагов, если у них осталось менее 15% HP (+7% за стек).',
      apply(mods) {
        mods.executeThreshold = Math.min(0.35, mods.executeThreshold + (mods.executeThreshold === 0 ? 0.15 : 0.07));
      }
    },
    {
      id: 'wpn_corpse_blast',
      title: 'Цепная Детонация',
      tag: 'ОРУДИЕ',
      icon: 'CRP',
      rarity: 'legendary',
      maxStacks: 3,
      desc: 'Погибшие враги взрываются, нанося 45% своего макс. HP по площади вокруг.',
      apply(mods) {
        mods.corpseBlastPct += 0.45;
      }
    },
    {
      id: 'wpn_heavy_slug',
      title: 'Обедненный Уран',
      tag: 'ОРУДИЕ',
      icon: 'HVS',
      rarity: 'rare',
      maxStacks: 4,
      desc: '+38% урона снарядов, крупнее калибр, -8% темпа стрельбы.',
      apply(mods) {
        mods.damageMult += 0.38;
        mods.fireRateMult = Math.max(0.6, mods.fireRateMult - 0.08);
        mods.bulletSizeBonus += 1.2;
      }
    },
    {
      id: 'wpn_rapid_coil',
      title: 'Ускоритель Ствола',
      tag: 'ОРУДИЕ',
      icon: 'RPD',
      rarity: 'common',
      maxStacks: 5,
      desc: '+22% скорострельности всех основных пушек.',
      apply(mods) {
        mods.fireRateMult += 0.22;
      }
    },

    // ===== +10 NEW CHRONO, DRONES & ECONOMY (91..100) =====
    {
      id: 'chr_bt_nova',
      title: 'Хроно-Сдвиг',
      tag: 'ХРОНО-МЕХАНИКА',
      icon: 'BTN',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'Вход в Bullet-Time [SPACE] создает ударную волну (240px), оглушающую врагов вокруг.',
      apply(mods) {
        mods.btNovaLevel += 1;
      }
    },
    {
      id: 'chr_bt_armor',
      title: 'Замедление Реальности',
      tag: 'ХРОНО-МЕХАНИКА',
      icon: 'BTA',
      rarity: 'rare',
      maxStacks: 3,
      desc: 'Во время активного Bullet-Time вы получаете на 30% меньше урона и быстро чините щит.',
      apply(mods) {
        mods.btArmorLevel += 1;
      }
    },
    {
      id: 'chr_rewind_blast',
      title: 'Временной Парадокс',
      tag: 'ХРОНО-МЕХАНИКА [Q]',
      icon: 'RWB',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'Применение Перемотки [Q] вызывает мощный взрыв в обеих точках — ухода и прибытия.',
      apply(mods) {
        mods.rewindBlastLevel += 1;
      }
    },
    {
      id: 'chr_drone_swarm',
      title: 'Гипер-Рой Дронов',
      tag: 'ОРБИТАЛЬНАЯ ЗАЩИТА',
      icon: 'SWM',
      rarity: 'legendary',
      maxStacks: 2,
      desc: '+3 орбитальных дрона Лагранжа и ускорение их вращения на +40%.',
      apply(mods, player) {
        mods.drones += 3;
        mods.droneSpeedBonus += 0.4;
        if (player) player.rebuildDrones();
      }
    },
    {
      id: 'chr_drone_laser',
      title: 'Лазерные Дроны',
      tag: 'ОРБИТАЛЬНАЯ ЗАЩИТА',
      icon: 'DLS',
      rarity: 'epic',
      maxStacks: 3,
      desc: 'Дроны выпускают пробивные импульсы с +35% урона и пробитием +1 цели.',
      apply(mods) {
        mods.droneLaser += 1;
        mods.droneTurrets = Math.max(1, mods.droneTurrets);
      }
    },
    {
      id: 'chr_scholar',
      title: 'Архитектор Опыта',
      tag: 'СИНЕРГИЯ',
      icon: 'SCH',
      rarity: 'common',
      maxStacks: 4,
      desc: '+25% получаемого опыта XP и мгновенно +1 Переброс в меню апгрейдов.',
      apply(mods, _player, game) {
        mods.xpMult += 0.25;
        if (game) game.rerolls += 1;
      }
    },
    {
      id: 'chr_tactician',
      title: 'Тактический Резерв',
      tag: 'СИНЕРГИЯ',
      icon: 'RRL',
      rarity: 'rare',
      maxStacks: 4,
      desc: 'Мгновенно дает +3 Переброса выбора модулей и +15% к получаемым очкам.',
      apply(mods, _player, game) {
        mods.scoreMultBonus += 0.15;
        if (game) game.rerolls += 3;
      }
    },
    {
      id: 'chr_afterburn',
      title: 'Реактивный Шлейф',
      tag: 'ХРОНО-МЕХАНИКА',
      icon: 'AFB',
      rarity: 'rare',
      maxStacks: 3,
      desc: 'Высокая скорость полета оставляет за кораблем огненные мины, взрывающиеся от врагов.',
      apply(mods) {
        mods.afterburnLevel += 1;
      }
    },
    {
      id: 'chr_clone_army',
      title: 'Квантовая Суперпозиция',
      tag: 'ХРОНО-МЕХАНИКА [Q]',
      icon: 'CLN',
      rarity: 'legendary',
      maxStacks: 2,
      desc: 'Каждые 9 сек автоматически призывает боевого Парадокс-Клона рядом с кораблем.',
      apply(mods) {
        mods.autoCloneLevel += 1;
      }
    },
    {
      id: 'chr_singularity_god',
      title: 'Апофеоз Сингулярности',
      tag: 'СИНЕРГИЯ',
      icon: 'GOD',
      rarity: 'legendary',
      maxStacks: 2,
      desc: '+15% ко всем базовым характеристикам (Урон, Скорострельность, Броня, Дыры и Ауры) и +1 макс. дыра.',
      apply(mods, player) {
        mods.damageMult += 0.15;
        mods.fireRateMult += 0.15;
        mods.armor = Math.min(0.75, mods.armor + 0.15);
        mods.wellGravMult += 0.15;
        mods.auraDpsMult += 0.15;
        mods.auraRadiusMult += 0.15;
        mods.maxWells += 1;
        if (player) {
          player.maxHp += 25;
          player.hp = Math.min(player.maxHp, player.hp + 25);
          player.maxShield += 25;
          player.shield = Math.min(player.maxShield, player.shield + 25);
        }
      }
    }
  ];

  function createDefaultMods() {
    return {
      damageMult: 1.0,
      projSpeedMult: 1.0,
      fireRateMult: 1.0,
      critChance: 0,
      critNova: 0,
      multishot: 1,
      spreadBonus: 0,
      bounces: 0,
      slingshotMult: 2.2,
      slingshotPierce: 1,
      maxWells: 2,
      binaryBridge: 0,
      hawkingDps: 22,
      wellRadiusMult: 1.0,
      wellGravMult: 1.0,
      wellLifeBonus: 0,
      hijackMult: 2.2,
      hijackShieldHeal: 2,
      chainTargets: 0,
      chainDamage: 0.5,
      supernovaDamage: 70,
      wellCdMult: 1.0,
      detonateCdMult: 1.0,
      paradoxClone: 0,
      rewindCdMult: 1.0,
      drones: 0,
      droneTurrets: 0,
      chronoRegenMult: 1.0,
      chronoOnKill: 0,
      moveSpeedMult: 1.0,
      bulletTimeFireBoost: 0.15,
      collisionMult: 1.0,
      vampOnKill: 0,
      dilationAura: 0,
      coronaDps: 0,
      coronaRadius: 0,
      stormLevel: 0,
      stormRadius: 0,
      cryoSlow: 0,
      cryoVuln: 0,
      cryoRadius: 0,
      repulseAura: 0,
      repulseRadius: 0,
      entropyDps: 0,
      entropyRadius: 0,
      pickupRadiusBonus: 0,
      shardBurst: 0,
      armor: 0,
      hpRegen: 0,
      shieldRegenMult: 1.0,
      thornsLevel: 0,
      ramLevel: 0,
      aegisBlast: 0,
      fortressLevel: 0,
      orbitTrap: 0,
      orbitCollider: 0,
      tidalVortex: 0,
      auraRadiusMult: 1.0,
      auraDpsMult: 1.0,
      novaLevel: 0,
      novaRadius: 0,
      radLevel: 0,
      radRadius: 0,
      berserkLevel: 0,
      // New 58 modules properties
      beamLevel: 0,
      beamRadius: 0,
      vortexPullLevel: 0,
      vortexPullRadius: 0,
      empLevel: 0,
      empRadius: 0,
      sanctuaryLevel: 0,
      thermalShock: 0,
      antimatterLevel: 0,
      antimatterRadius: 0,
      pocketHoleLevel: 0,
      resonanceEcho: 0,
      solarFlareLevel: 0,
      phoenixCharges: 0,
      dodgeChance: 0,
      xpHeal: 0,
      whiteMedic: 0,
      adaptiveArmor: 0,
      shieldOnKill: 0,
      bulletEater: 0,
      staticBarrier: 0,
      leechNova: 0,
      orbitCapBonus: 0,
      orbitSparks: 0,
      autoWellLevel: 0,
      eventCrushPct: 0,
      wellXpVacuum: 0,
      cascadeWell: 0,
      slingshotCrit: 0,
      orbitReleaseHeal: 0,
      whiteNova: 0,
      darkMatterMult: 0,
      orbitReleaseMult: 0,
      homingStrength: 0,
      splashLevel: 0,
      igniteLevel: 0,
      frostRounds: 0,
      rearGuns: 0,
      sideGuns: 0,
      burstEcho: 0,
      basePierce: 0,
      bulletLifeMult: 1.0,
      bossDamageBonus: 0,
      executeThreshold: 0,
      corpseBlastPct: 0,
      bulletSizeBonus: 0,
      btNovaLevel: 0,
      btArmorLevel: 0,
      rewindBlastLevel: 0,
      droneSpeedBonus: 0,
      droneLaser: 0,
      xpMult: 1.0,
      scoreMultBonus: 0,
      afterburnLevel: 0,
      autoCloneLevel: 0,
      // Apex Evolution flags
      evoCoronaSupernova: 0,
      evoCryoShatter: 0,
      evoStormChain: 0,
      evoRepulseReflect: 0,
      evoEntropyTether: 0,
      evoBeamPrism: 0,
      evoRadiationMeltdown: 0,
      evoOrbitSingularity: 0,
      evoBinaryLattice: 0,
      evoSlingshotRail: 0,
      evoSupernovaChain: 0,
      evoAutoWellTwin: 0,
      evoHijackHoming: 0,
      evoSplitStar: 0,
      evoRicochetSplit: 0,
      evoCritExecute: 0,
      evoCorpseChain: 0,
      evoThornsRing: 0,
      evoAegisImmortal: 0,
      evoPhoenixEternal: 0,
      evoRamJuggernaut: 0,
      evoDronesOverdrive: 0,
      evoRewindArmy: 0,
      evoChronoOverclock: 0
    };
  }

  const EVOLUTIONS = {
    slingshot_mastery: {
      title: 'Квантовая Рельсовая Праща',
      perk: 'Снаряды из пращи вызывают плазменный взрыв 100px (60% урона) при попадании и получают +2 пробития.',
      apply(mods) { mods.evoSlingshotRail = 1; mods.slingshotPierce += 2; mods.slingshotMult += 0.5; }
    },
    binary_stars: {
      title: 'Бинарная Решетка',
      perk: 'Плазменные мосты между дырами тянутся до 820px, наносят 300 урона/сек и бьют цепной молнией.',
      apply(mods) { mods.evoBinaryLattice = 1; mods.maxWells += 1; }
    },
    hawking_burn: {
      title: 'Квазарное Испарение',
      perk: 'Ядра дыр выжигают +90/сек и запускают эффект распада горизонта (+2% HP/сек).',
      apply(mods) { mods.hawkingDps += 90; mods.eventCrushPct += 0.02; }
    },
    kinetic_hijack: {
      title: 'Абсолютный Перехват',
      perk: 'Перехваченные вражеские пули получают сильное самонаведение, чинят +5 щита и бьют искрами.',
      apply(mods) { mods.evoHijackHoming = 1; mods.hijackMult += 1.0; }
    },
    split_prism: {
      title: 'Звездный Веер',
      perk: 'Каждый 3-й залп выпускает 12 радиальных звездных болтов вокруг корабля.',
      apply(mods) { mods.evoSplitStar = 1; mods.multishot += 1; }
    },
    ricochet_prism: {
      title: 'Фрактальный Рикошет',
      perk: 'При каждом отскоке от стены пуля раздваивается, создавая самонаводящегося двойника.',
      apply(mods) { mods.evoRicochetSplit = 1; mods.bounces += 1; }
    },
    tesla_chain: {
      title: 'Штормовой Проводник',
      perk: 'Цепная молния бьет еще на +3 цели с повышенным (85%) уроном.',
      apply(mods) { mods.chainTargets += 3; mods.chainDamage = Math.max(mods.chainDamage, 0.85); }
    },
    supernova_collapse: {
      title: 'Цепной Катаклизм [E]',
      perk: 'Детонация [E] расширяется на 45%, бьет на +40% сильнее и откатывается вдвое быстрее при >=3 убийствах.',
      apply(mods) { mods.evoSupernovaChain = 1; mods.supernovaDamage += 80; }
    },
    paradox_clone: {
      title: 'Легион Времени [Q]',
      perk: 'Перемотка [Q] призывает 3 элитных Парадокс-Клонов, стреляющих залпами по 3 импульса.',
      apply(mods) { mods.evoRewindArmy = 1; mods.rewindCdMult *= 0.85; }
    },
    lagrange_drones: {
      title: 'Орбитальная Армада',
      perk: 'Дроны выстраиваются в двойное кольцо (+60% скорость), стреляют самонаводящимися зарядами (+2 дрона).',
      apply(mods, player) { mods.evoDronesOverdrive = 1; mods.drones += 2; mods.droneTurrets = Math.max(1, mods.droneTurrets); if (player) player.rebuildDrones(); }
    },
    chrono_reactor: {
      title: 'Властелин Времени',
      perk: 'Расход Хроно-энергии в Bullet-Time снижен на 45%, а корабль выпускает самонаводящиеся Хроно-Копья.',
      apply(mods) { mods.evoChronoOverclock = 1; mods.bulletTimeFireBoost += 0.25; }
    },
    annihilation_harvest: {
      title: 'Кровавая Сингулярность',
      perk: 'Удваивает вампиризм при убийстве (+6 HP) и активирует Алую Вспышку каждые 30 ед. лечения.',
      apply(mods) { mods.vampOnKill += 6; mods.leechNova = Math.max(1, mods.leechNova + 1); }
    },
    rail_caliber: {
      title: 'Релятивистский Болт',
      perk: '+45% скорость снарядов, +30% урон и +2 пробития насквозь.',
      apply(mods) { mods.projSpeedMult += 0.45; mods.damageMult += 0.3; mods.basePierce += 2; }
    },
    dilation_halo: {
      title: 'Хроно-Сфера Защиты',
      perk: 'Вражеские пули у корабля замедляются до 20% скорости и корабль ускоряется на +15%.',
      apply(mods) { mods.dilationAura = 0.8; mods.moveSpeedMult += 0.15; }
    },
    aura_corona: {
      title: 'Гипернова Короны',
      perk: 'Каждые 3 сек выпускает обжигающую волну короны на 130% радиуса с поджогом всех врагов.',
      apply(mods) { mods.evoCoronaSupernova = 1; mods.coronaDps += 35; }
    },
    aura_storm: {
      title: 'Грозовой Коллапс',
      perk: 'Молнии Штормовой Спирали оглушают пораженные цели на 0.4с и прыгают по цепочке.',
      apply(mods) { mods.evoStormChain = 1; mods.stormLevel += 1; }
    },
    aura_cryo: {
      title: 'Абсолютный Ноль',
      perk: 'Убитые в крио-поле враги раскалываются на 6 пробивных ледяных осколков.',
      apply(mods) { mods.evoCryoShatter = 1; mods.cryoVuln += 0.15; }
    },
    aura_repulse: {
      title: 'Зеркальный Горизонт',
      perk: 'Ударная волна Отталкивающей мантии разворачивает вражеские пули обратно во врагов с наведением.',
      apply(mods) { mods.evoRepulseReflect = 1; mods.repulseRadius += 40; }
    },
    aura_entropy: {
      title: 'Багряный Поток',
      perk: 'Удваивает вытягивание жизни и восстанавливает +6 HP / +10 щита при гибели врага в радиусе ауры.',
      apply(mods) { mods.evoEntropyTether = 1; mods.entropyDps += 25; }
    },
    aura_magnet: {
      title: 'Гравитационный Пылесос',
      perk: '+350px к радиусу магнита кристаллов и встроенный Вакуумный сбор через черные дыры.',
      apply(mods) { mods.pickupRadiusBonus += 350; mods.wellXpVacuum = Math.max(1, mods.wellXpVacuum); }
    },
    gravity_mastery: {
      title: 'Архитектор Сверхмассы',
      perk: '+35% сила искажения и +25% радиус всех сингулярностей; праща становится критической.',
      apply(mods) { mods.wellGravMult += 0.35; mods.wellRadiusMult += 0.25; mods.slingshotCrit = 1; }
    },
    overclock_core: {
      title: 'Орудийная Матрица',
      perk: '+30% скорострельность, +25% урон и +1 дополнительный ствол.',
      apply(mods) { mods.fireRateMult += 0.3; mods.damageMult += 0.25; mods.multishot += 1; }
    },
    singularity_shards: {
      title: 'Каскад Осколков',
      perk: 'Количество осколков при гибели в дыре или ауре увеличено вдвое (+4 осколка), все осколки самонаводящиеся.',
      apply(mods) { mods.shardBurst += 4; mods.homingStrength = Math.max(1, mods.homingStrength); }
    },
    tank_hull: {
      title: 'Титановая Броня Титана',
      perk: '+100 к максимуму HP и щитов, +15% брони.',
      apply(mods, player) { mods.armor = Math.min(0.75, mods.armor + 0.15); if (player) { player.maxHp += 100; player.hp = Math.min(player.maxHp, player.hp + 100); player.maxShield += 100; player.shield = Math.min(player.maxShield, player.shield + 100); } }
    },
    tank_regen: {
      title: 'Бессмертная Матрица',
      perk: '+8 HP/сек регенерации, +40% зарядки щита и активация Алой Вспышки от лечения.',
      apply(mods) { mods.hpRegen += 8; mods.shieldRegenMult += 0.4; mods.leechNova = Math.max(1, mods.leechNova); }
    },
    tank_thorns: {
      title: 'Зеркало Шипов',
      perk: 'Получение урона выпускает кольцо из 12 пробивных шипов и отражает вражеские пули вокруг.',
      apply(mods) { mods.evoThornsRing = 1; mods.thornsLevel += 1; }
    },
    tank_ram: {
      title: 'Таран Несокрушимости',
      perk: 'Таран дает 0.5с неуязвимости, +8 щита и взрывную волну 160px по врагам вокруг.',
      apply(mods) { mods.evoRamJuggernaut = 1; mods.ramLevel += 1; }
    },
    tank_aegis: {
      title: 'Непробиваемая Эгида',
      perk: 'Срыв щита замораживает весь экран на 360px (3.5с стана), дает 2с неуязвимости и стирает вражеские пули.',
      apply(mods) { mods.evoAegisImmortal = 1; }
    },
    tank_fortress: {
      title: 'Цитадель Сингулярности',
      perk: 'Удваивает бонус урона аур при высоком HP (+45%) и усиливает защиту на низком HP.',
      apply(mods) { mods.fortressLevel += 1; mods.armor = Math.min(0.75, mods.armor + 0.12); }
    },
    orbit_trap: {
      title: 'Орбитальный Суперколлайдер',
      perk: 'Макс. заряд орбитальных пуль растет до x5.0, +16 емкость захвата, залп дублируется с самонаведением.',
      apply(mods) { mods.evoOrbitSingularity = 1; mods.orbitCapBonus += 16; }
    },
    orbit_collider: {
      title: 'Кольцо Сверхновых',
      perk: 'Все орбитальные пули в дыре заряжаются быстрее, стреляют искрами и лечат щит при залпе.',
      apply(mods) { mods.orbitSparks = Math.max(1, mods.orbitSparks + 1); mods.orbitReleaseHeal += 2; mods.orbitReleaseMult += 0.4; }
    },
    hyper_gravity: {
      title: 'Горизонт Тьмы',
      perk: '+60% гравитационное искажение, +1 макс. дыра и +16% урон за каждую активную дыру.',
      apply(mods) { mods.wellGravMult += 0.6; mods.maxWells += 1; mods.darkMatterMult += 0.16; }
    },
    tidal_vortex: {
      title: 'Смерч Событий',
      perk: 'Приливное закручивание удваивается, +65/сек урон Хокинга и +18% скорость полета.',
      apply(mods) { mods.tidalVortex += 1; mods.hawkingDps += 65; mods.projSpeedMult += 0.18; }
    },
    well_haste: {
      title: 'Вечный Реактор Дыр',
      perk: 'Перезарядка черных дыр и [E] снижена еще на 30%, +3с к их времени жизни.',
      apply(mods) { mods.wellCdMult *= 0.7; mods.detonateCdMult *= 0.7; mods.wellLifeBonus += 3.0; }
    },
    aura_mastery: {
      title: 'Повелитель Полей',
      perk: '+35% к радиусу и +45% к урону всех аур.',
      apply(mods) { mods.auraRadiusMult += 0.35; mods.auraDpsMult += 0.45; }
    },
    aura_nova: {
      title: 'Солнечный Коллапс',
      perk: 'Пульсирующая Нова расширяется на +90px и поджигает всех задетых врагов.',
      apply(mods) { mods.novaRadius += 90; mods.igniteLevel = Math.max(1, mods.igniteLevel); mods.novaLevel += 1; }
    },
    aura_radiation: {
      title: 'Критическая Распад-Реакция',
      perk: 'При 12 стаках распада враг детонирует зеленой волной 150px и заражает соседей.',
      apply(mods) { mods.evoRadiationMeltdown = 1; mods.radRadius += 40; }
    },
    drone_turrets: {
      title: 'Ударные Лазер-Дроны',
      perk: 'Дроны стреляют самонаводящимися лазерными импульсами с +1 пробитием.',
      apply(mods) { mods.evoDronesOverdrive = 1; mods.droneLaser += 1; }
    },
    berserk_core: {
      title: 'Ядро Безумного Реактора',
      perk: '+35% базового урона и скорострельности даже при полном здоровье.',
      apply(mods) { mods.damageMult += 0.35; mods.fireRateMult += 0.35; }
    },
    chrono_kill: {
      title: 'Временной Поток',
      perk: 'Убийства вдвое сильнее откатывают [Q]/[E] и заряжают Хроно-энергию.',
      apply(mods) { mods.chronoOnKill += 2; mods.chronoRegenMult += 0.35; }
    },
    scatter_cannon: {
      title: 'Орбитальный Залп',
      perk: '+3 дополнительных ствола в веере и +25% к урону снарядов.',
      apply(mods) { mods.multishot += 3; mods.damageMult += 0.25; }
    },
    crit_nova: {
      title: 'Критический Армагеддон',
      perk: 'Крит-взрывы расширяются до 125px, +20% шанс крита и всегда вызывают цепную молнию.',
      apply(mods) { mods.evoCritExecute = 1; mods.critChance = Math.min(0.95, mods.critChance + 0.2); mods.chainTargets = Math.max(2, mods.chainTargets); }
    },
    aura_beam: {
      title: 'Тройной Призма-Луч',
      perk: 'Квантовый луч разделяется и одновременно выжигает до 3 ближайших врагов.',
      apply(mods) { mods.evoBeamPrism = 1; mods.beamRadius += 60; }
    },
    aura_vortex_pull: {
      title: 'Магнитная Воронка',
      perk: '+110px к радиусу притягивающей ауры и +30% к силе урона всех аур.',
      apply(mods) { mods.vortexPullRadius += 110; mods.vortexPullLevel += 1; mods.auraDpsMult += 0.3; }
    },
    aura_emp: {
      title: 'Сверх-ЭМИ Катушка',
      perk: '+80px радиуса ЭМИ-импульса и дополнительная цепная молния от каждого разряда.',
      apply(mods) { mods.empRadius += 80; mods.empLevel += 1; mods.chainTargets = Math.max(1, mods.chainTargets + 1); }
    },
    aura_sanctuary: {
      title: 'Бастион Тишины',
      perk: 'Удваивает бонус регенерации щита и расширяет личную броню на +14%.',
      apply(mods) { mods.sanctuaryLevel += 2; mods.armor = Math.min(0.75, mods.armor + 0.14); }
    },
    aura_thermal_shock: {
      title: 'Плазменный Крио-Терм',
      perk: 'Включает Корону и Крио-стазис если отсутствуют, и еще на +120% усиливает термошок.',
      apply(mods) { mods.thermalShock += 1; if (mods.coronaRadius <= 0) { mods.coronaRadius = 115; mods.coronaDps = 22; } if (mods.cryoRadius <= 0) { mods.cryoRadius = 140; mods.cryoSlow = 0.28; } }
    },
    aura_antimatter: {
      title: 'Щит Аннигиляции',
      perk: '+60px к радиусу барьера антиматерии и +35 макс. щита с ускоренной зарядкой.',
      apply(mods, player) { mods.antimatterRadius += 60; mods.shieldRegenMult += 0.35; if (player) { player.maxShield += 35; player.shield = player.maxShield; } }
    },
    aura_overcharge: {
      title: 'Абсолютный Резонанс Полей',
      perk: '+75% урона и +25% радиуса ко всем активным аурам.',
      apply(mods) { mods.auraDpsMult += 0.75; mods.auraRadiusMult += 0.25; }
    },
    aura_gravity_well: {
      title: 'Карманная Сингулярность',
      perk: 'Искривление вражеских пуль вокруг корабля удваивается и перехватывает искривленные снаряды.',
      apply(mods) { mods.pocketHoleLevel += 2; mods.evoHijackHoming = 1; }
    },
    aura_resonance_echo: {
      title: 'Штормовая Симфония',
      perk: 'Молнии бьют по +2 дополнительным целям с усиленным резонансом.',
      apply(mods) { mods.resonanceEcho += 2; mods.chainTargets += 2; }
    },
    aura_solar_flare: {
      title: 'Пульсар Протуберанцев',
      perk: 'Активирует взрывную волну Гиперновы Короны и +30% к урону аур.',
      apply(mods) { mods.evoCoronaSupernova = 1; mods.solarFlareLevel += 1; mods.auraDpsMult += 0.3; }
    },
    tank_phoenix: {
      title: 'Бессмертный Феникс',
      perk: 'Воскрешение мгновенно сбрасывает все откаты ([Q]/[E]/Дыры), призывает 2 Черные Дыры и добавляет +1 заряд.',
      apply(mods) { mods.evoPhoenixEternal = 1; mods.phoenixCharges += 1; }
    },
    tank_phase_dodge: {
      title: 'Призрачный Сдвиг',
      perk: 'Шанс полного уклонения вырастает до 65%, +15% скорости полета.',
      apply(mods) { mods.dodgeChance = Math.min(0.65, mods.dodgeChance + 0.15); mods.moveSpeedMult += 0.15; }
    },
    tank_juggernaut: {
      title: 'Живой Дредноут',
      perk: '+150 макс. HP, компенсирует штраф скорости (+12%) и дает +10% брони.',
      apply(mods, player) { mods.moveSpeedMult += 0.12; mods.armor = Math.min(0.75, mods.armor + 0.1); if (player) { player.maxHp += 150; player.hp = Math.min(player.maxHp, player.hp + 150); } }
    },
    tank_shield_capacitor: {
      title: 'Мега-Конденсатор',
      perk: '+110 макс. щита, мгновенная полная зарядка и +35% к регенерации щита.',
      apply(mods, player) { mods.shieldRegenMult += 0.35; if (player) { player.maxShield += 110; player.shield = player.maxShield; } }
    },
    tank_xp_siphon: {
      title: 'Био-Реактор Опыта',
      perk: 'Кристаллы XP лечат вдвое больше (+3 HP/кристалл) и дают +20% к получаемому опыту.',
      apply(mods) { mods.xpHeal += 3; mods.xpMult += 0.2; }
    },
    tank_white_medic: {
      title: 'Зона Бессмертия',
      perk: 'Белые Дыры лечат +12 HP/сек и +14 щита/сек, снижая откат дыр на 20%.',
      apply(mods) { mods.whiteMedic += 2; mods.wellCdMult *= 0.8; }
    },
    tank_adaptive_plate: {
      title: 'Реактивный Нано-Щит',
      perk: 'Срабатывание Адаптивной брони усиливает сопротивление и дарит +50 макс. HP.',
      apply(mods, player) { mods.adaptiveArmor += 1; mods.armor = Math.min(0.75, mods.armor + 0.1); if (player) { player.maxHp += 50; player.hp = Math.min(player.maxHp, player.hp + 50); } }
    },
    tank_corpse_shield: {
      title: 'Повелитель Щитов',
      perk: 'Восстановление щита за убийство увеличено на +6 и +30 к максимуму щита.',
      apply(mods, player) { mods.shieldOnKill += 6; if (player) { player.maxShield += 30; player.shield = Math.min(player.maxShield, player.shield + 30); } }
    },
    tank_bulkhead: {
      title: 'Неразрушимый Корпус',
      perk: '+15% к базовой броне и +80 макс. HP.',
      apply(mods, player) { mods.armor = Math.min(0.75, mods.armor + 0.15); if (player) { player.maxHp += 80; player.hp = Math.min(player.maxHp, player.hp + 80); } }
    },
    tank_bullet_eater: {
      title: 'Пожиратель Бурь',
      perk: 'Поглощение пули Черной Дырой лечит +5 HP и +7 щита и расширяет радиус дыр на 20%.',
      apply(mods) { mods.bulletEater += 2; mods.wellRadiusMult += 0.2; }
    },
    tank_static_barrier: {
      title: 'Турбо-Барьер',
      perk: '+45% скорость зарядки щитов и +20% скорость полета при полном щите.',
      apply(mods) { mods.shieldRegenMult += 0.45; mods.staticBarrier += 2; }
    },
    tank_leech_nova: {
      title: 'Кровавое Затмение',
      perk: 'Удваивает урон Алой Вспышки и дает +4 HP вампиризма за каждое убийство.',
      apply(mods) { mods.leechNova += 2; mods.vampOnKill += 4; }
    },
    orbit_mega_cap: {
      title: 'Сверхплотный Рой',
      perk: '+24 емкости орбитальных пуль, ускоренное вращение и +100% урона залпа.',
      apply(mods) { mods.orbitCapBonus += 24; mods.orbitReleaseMult += 1.0; mods.evoOrbitSingularity = 1; }
    },
    orbit_turret_sparks: {
      title: 'Орбитальная Плазма-Турель',
      perk: 'Орбитальные пули стреляют вдвое чаще и заряжаются быстрее.',
      apply(mods) { mods.orbitSparks += 2; mods.orbitCollider = Math.max(1, mods.orbitCollider); }
    },
    orbit_auto_well: {
      title: 'Двойной Авто-Коллайдер',
      perk: 'Авто-Маяк одновременно создает Черную Дыру во врагах и Белую Дыру в 120px.',
      apply(mods) { mods.evoAutoWellTwin = 1; mods.maxWells += 1; }
    },
    orbit_event_crush: {
      title: 'Абсолютное Раздавливание',
      perk: 'Удваивает процентный разрыв HP внутри черных дыр (+4%/сек) и урон Хокинга.',
      apply(mods) { mods.eventCrushPct += 0.04; mods.hawkingDps += 45; }
    },
    orbit_long_horizon: {
      title: 'Вечная Сингулярность',
      perk: '+6 сек к жизни всех дыр и +25% к радиусу их влияния.',
      apply(mods) { mods.wellLifeBonus += 6.0; mods.wellRadiusMult += 0.25; }
    },
    orbit_xp_magnet: {
      title: 'Квантовый Сборщик',
      perk: 'Дыры собирают кристаллы и лечат +2 HP/кристалл даже без танковых перков.',
      apply(mods) { mods.wellXpVacuum += 2; mods.xpHeal += 2; }
    },
    orbit_twin_detonate: {
      title: 'Бесконечное Эхо Коллапса [E]',
      perk: 'Запускает цепную реакцию [E] с повышенным уроном и мгновенным появлением новых микро-дыр.',
      apply(mods) { mods.evoSupernovaChain = 1; mods.cascadeWell += 1; mods.supernovaDamage += 60; }
    },
    orbit_slingshot_crit: {
      title: 'Сверхкритическая Праща',
      perk: 'Пули пращи всегда критуют, наносят еще +75% урона и пробивают на +2 цели.',
      apply(mods) { mods.slingshotMult += 0.75; mods.slingshotPierce += 2; mods.evoSlingshotRail = 1; }
    },
    orbit_well_heal: {
      title: 'Гармонический Сифон',
      perk: 'Каждая выпущенная пуля из орбиты чинит +5 щита и наносит +50% урона.',
      apply(mods) { mods.orbitReleaseHeal += 5; mods.orbitReleaseMult += 0.5; }
    },
    orbit_white_nova: {
      title: 'Репульсорное Зеркало',
      perk: 'Белые дыры разворачивают все вражеские пули с усиленным наведением и удвоенным уроном.',
      apply(mods) { mods.whiteNova += 2; mods.hijackMult += 0.6; }
    },
    orbit_dark_matter: {
      title: 'Трон Темной Материи',
      perk: '+25% урона за каждую активную дыру и +2 к максимуму одновременных дыр.',
      apply(mods) { mods.darkMatterMult += 0.25; mods.maxWells += 2; }
    },
    orbit_zero_drag: {
      title: 'Гипер-Импульс Орбиты',
      perk: 'Удваивает бонус залпа (+100% урона) и активирует дублирование выстрелов.',
      apply(mods) { mods.orbitReleaseMult += 1.0; mods.evoOrbitSingularity = 1; }
    },
    wpn_homing: {
      title: 'Абсолютное Самонаведение',
      perk: 'Максимальная маневренность снарядов и +20% к дальности их полета.',
      apply(mods) { mods.homingStrength += 2; mods.bulletLifeMult += 0.2; }
    },
    wpn_splash: {
      title: 'Термоядерная Шрапнель',
      perk: 'Радиус осколочных взрывов увеличен вдвое, +20% базового урона пушек.',
      apply(mods) { mods.splashLevel += 2; mods.damageMult += 0.2; }
    },
    wpn_ignite: {
      title: 'Звездное Пламя',
      perk: 'Удваивает урон горения от пуль и активирует синергию Термошока.',
      apply(mods) { mods.igniteLevel += 2; mods.thermalShock = Math.max(1, mods.thermalShock); }
    },
    wpn_frost_rounds: {
      title: 'Осколочный Лед',
      perk: 'Замороженные враги разлетаются на 6 пробивных ледяных осколков при гибели.',
      apply(mods) { mods.evoCryoShatter = 1; mods.frostRounds += 1; mods.cryoVuln += 0.12; }
    },
    wpn_rear_gun: {
      title: 'Кормовой Залп Сверхновой',
      perk: '+2 кормовых ствола и +20% к скорострельности всех пушек.',
      apply(mods) { mods.rearGuns += 2; mods.fireRateMult += 0.2; }
    },
    wpn_side_guns: {
      title: 'Крейсерская Батарея',
      perk: 'Удваивает бортовые залпы и сужает основной веер огня.',
      apply(mods) { mods.sideGuns += 1; mods.multishot += 1; mods.damageMult += 0.2; }
    },
    wpn_burst_echo: {
      title: 'Квантовый Двойной Залп',
      perk: 'Удваивает урон усиленного 4-го выстрела и повышает темп стрельбы на +25%.',
      apply(mods) { mods.burstEcho += 2; mods.fireRateMult += 0.25; }
    },
    wpn_pierce_lance: {
      title: 'Копье Бесконечности',
      perk: '+4 сквозных пробития на все снаряды и +25% к скорости пули.',
      apply(mods) { mods.basePierce += 4; mods.projSpeedMult += 0.25; }
    },
    wpn_sniper_range: {
      title: 'Снайперский Рельсотрон',
      perk: '+45% скорость снарядов, +35% дальность и +25% шанс крита.',
      apply(mods) { mods.projSpeedMult += 0.45; mods.bulletLifeMult += 0.35; mods.critChance = Math.min(0.95, mods.critChance + 0.25); }
    },
    wpn_boss_killer: {
      title: 'Палач Левиафанов',
      perk: '+80% урона по боссам и тяжелым врагам и +20% базового урона.',
      apply(mods) { mods.bossDamageBonus += 0.8; mods.damageMult += 0.2; }
    },
    wpn_execute: {
      title: 'Омега-Ликвидатор',
      perk: 'Добивает обычных врагов при 40% HP и дает +25% к урону.',
      apply(mods) { mods.executeThreshold = Math.max(mods.executeThreshold, 0.4); mods.damageMult += 0.25; }
    },
    wpn_corpse_blast: {
      title: 'Цепной Апокалипсис',
      perk: 'Взрыв погибшего врага разбрасывает 4 самонаводящихся плазменных осколка и наносит +35% больше урона.',
      apply(mods) { mods.evoCorpseChain = 1; mods.corpseBlastPct += 0.35; }
    },
    wpn_heavy_slug: {
      title: 'Ядерный Калибр',
      perk: '+65% урона пушек, +2 пробития и крупные заряды с осколочным взрывом.',
      apply(mods) { mods.damageMult += 0.65; mods.basePierce += 2; mods.splashLevel = Math.max(1, mods.splashLevel); }
    },
    wpn_rapid_coil: {
      title: 'Пулеметный Гипердрайв',
      perk: '+55% к скорострельности и +1 дополнительный ствол.',
      apply(mods) { mods.fireRateMult += 0.55; mods.multishot += 1; }
    },
    chr_bt_nova: {
      title: 'Темпоральный Коллапс',
      perk: 'Активация Bullet-Time бьет вдвое сильнее и снижает расход Хроно-энергии.',
      apply(mods) { mods.btNovaLevel += 2; mods.evoChronoOverclock = 1; }
    },
    chr_bt_armor: {
      title: 'Неуязвимость Времени',
      perk: 'В замедлении времени защита и регенерация щита вырастают вдвое, +40 макс. щита.',
      apply(mods, player) { mods.btArmorLevel += 2; if (player) { player.maxShield += 40; player.shield = player.maxShield; } }
    },
    chr_rewind_blast: {
      title: 'Двойная Детонация Парадокса',
      perk: 'Перемотка [Q] призывает армию из 3 клонов и взрывается с удвоенной мощью.',
      apply(mods) { mods.rewindBlastLevel += 2; mods.evoRewindArmy = 1; }
    },
    chr_drone_swarm: {
      title: 'Абсолютный Рой Лагранжа',
      perk: '+4 дрона в двух кольцах, самонаводящиеся турели и +60% к их скорости.',
      apply(mods, player) { mods.evoDronesOverdrive = 1; mods.drones += 4; mods.droneTurrets = Math.max(1, mods.droneTurrets); if (player) player.rebuildDrones(); }
    },
    chr_drone_laser: {
      title: 'Фотонный Флот',
      perk: 'Турели дронов бьют на +70% сильнее с самонаведением и +2 пробития.',
      apply(mods) { mods.droneLaser += 2; mods.evoDronesOverdrive = 1; }
    },
    chr_scholar: {
      title: 'Мудрость Вселенной',
      perk: '+50% к опыту XP и мгновенно +2 переброса в меню апгрейдов.',
      apply(mods, _player, game) { mods.xpMult += 0.5; if (game) game.rerolls += 2; }
    },
    chr_tactician: {
      title: 'Гроссмейстер Сингулярности',
      perk: '+5 перебросов, +30% к очкам и +15% ко всем основным статам.',
      apply(mods, _player, game) { mods.scoreMultBonus += 0.3; mods.damageMult += 0.15; mods.fireRateMult += 0.15; if (game) game.rerolls += 5; }
    },
    chr_afterburn: {
      title: 'Плазменный Форсаж',
      perk: '+20% к скорости полета и огненные мины взрываются вдвое крупнее.',
      apply(mods) { mods.afterburnLevel += 2; mods.moveSpeedMult += 0.2; mods.splashLevel = Math.max(1, mods.splashLevel); }
    },
    chr_clone_army: {
      title: 'Квантовая Армия',
      perk: 'Клоны появляются вдвое чаще, а перемотка [Q] выпускает треугольник из 3 усиленных клонов.',
      apply(mods) { mods.autoCloneLevel += 1; mods.evoRewindArmy = 1; }
    },
    chr_singularity_god: {
      title: 'Бог Сингулярности',
      perk: '+35% ко всем параметрам (Урон, Темп, Броня, Дыры, Ауры), +2 макс. дыры и +100 HP/Щита.',
      apply(mods, player) {
        mods.damageMult += 0.35;
        mods.fireRateMult += 0.35;
        mods.armor = Math.min(0.75, mods.armor + 0.2);
        mods.wellGravMult += 0.35;
        mods.auraDpsMult += 0.35;
        mods.auraRadiusMult += 0.35;
        mods.maxWells += 2;
        if (player) {
          player.maxHp += 100;
          player.hp = Math.min(player.maxHp, player.hp + 100);
          player.maxShield += 100;
          player.shield = Math.min(player.maxShield, player.shield + 100);
        }
      }
    }
  };

  const PREREQUISITES = {
    orbit_collider: { requires: ['orbit_trap'], label: 'Орбитальная Ловушка' },
    orbit_mega_cap: { requires: ['orbit_trap'], label: 'Орбитальная Ловушка' },
    orbit_turret_sparks: { requires: ['orbit_trap'], label: 'Орбитальная Ловушка' },
    orbit_well_heal: { requires: ['orbit_trap'], label: 'Орбитальная Ловушка' },
    orbit_zero_drag: { requires: ['orbit_trap'], label: 'Орбитальная Ловушка' },
    chr_drone_laser: {
      requires: [['lagrange_drones', 'drone_turrets', 'chr_drone_swarm']],
      label: 'Любой модуль дронов'
    },
    aura_mastery: {
      requires: [[
        'aura_corona', 'aura_storm', 'aura_cryo', 'aura_repulse',
        'aura_entropy', 'aura_nova', 'aura_radiation', 'aura_beam',
        'aura_vortex_pull', 'aura_emp', 'aura_antimatter', 'aura_solar_flare'
      ]],
      label: 'Любая активная аура'
    },
    aura_overcharge: {
      requires: [[
        'aura_corona', 'aura_storm', 'aura_cryo', 'aura_repulse',
        'aura_entropy', 'aura_nova', 'aura_radiation', 'aura_beam',
        'aura_vortex_pull', 'aura_emp', 'aura_antimatter', 'aura_solar_flare'
      ]],
      label: 'Любая активная аура'
    },
    aura_thermal_shock: {
      requires: [['aura_cryo', 'wpn_frost_rounds', 'aura_beam'], ['aura_corona', 'aura_solar_flare', 'wpn_ignite']],
      label: 'Крио + Огонь/Корона'
    },
    aura_resonance_echo: {
      requires: [['aura_storm', 'tesla_chain']],
      label: 'Грозовой Ореол или Резонансная Дуга'
    }
  };

  UPGRADES.forEach(u => {
    u.evolution = EVOLUTIONS[u.id];
    if (!u.evolution) {
      throw new Error(`Missing evolution definition for upgrade: ${u.id}`);
    }
    const prereq = PREREQUISITES[u.id];
    if (prereq) {
      u.requires = prereq.requires;
      u.requiresLabel = prereq.label;
    }
  });

  function meetsUpgradeRequirements(upg, stacksMap) {
    if (!upg || !upg.requires || upg.requires.length === 0) return true;
    for (let i = 0; i < upg.requires.length; i++) {
      const req = upg.requires[i];
      if (Array.isArray(req)) {
        if (!req.some(id => (stacksMap[id] || 0) > 0)) return false;
      } else if ((stacksMap[req] || 0) <= 0) {
        return false;
      }
    }
    return true;
  }

  function isUpgradeEligible(upg, stacksMap, evolvedSet = null) {
    if (!upg) return false;
    if ((stacksMap[upg.id] || 0) >= upg.maxStacks) return false;
    if (evolvedSet && evolvedSet.has(upg.id)) return false;
    return meetsUpgradeRequirements(upg, stacksMap);
  }

  function countEligibleUpgrades(stacksMap, evolvedSet = null) {
    let total = 0;
    for (let i = 0; i < UPGRADES.length; i++) {
      if (isUpgradeEligible(UPGRADES[i], stacksMap, evolvedSet)) {
        total++;
      }
    }
    return total;
  }

  function rollUpgradeChoices(stacksMap, count = 4, evolvedSet = null) {
    const eligible = UPGRADES.filter(u => isUpgradeEligible(u, stacksMap, evolvedSet));
    const pool = eligible.map(u => {
      const s = stacksMap[u.id] || 0;
      const weight = (s + 1 === u.maxStacks) ? 3.2 : (s > 0 ? 2.1 : 1.0);
      return { upg: u, weight };
    });
    const picked = [];
    while (picked.length < count && pool.length > 0) {
      let totalW = 0;
      for (let i = 0; i < pool.length; i++) totalW += pool[i].weight;
      let r = Math.random() * totalW;
      let chosenIdx = pool.length - 1;
      for (let i = 0; i < pool.length; i++) {
        r -= pool[i].weight;
        if (r <= 0) {
          chosenIdx = i;
          break;
        }
      }
      picked.push(pool.splice(chosenIdx, 1)[0].upg);
    }
    return picked;
  }

  SG.UPGRADES = UPGRADES;
  SG.EVOLUTIONS = EVOLUTIONS;
  SG.createDefaultMods = createDefaultMods;
  SG.meetsUpgradeRequirements = meetsUpgradeRequirements;
  SG.isUpgradeEligible = isUpgradeEligible;
  SG.countEligibleUpgrades = countEligibleUpgrades;
  SG.rollUpgradeChoices = rollUpgradeChoices;
})(window.SG);
