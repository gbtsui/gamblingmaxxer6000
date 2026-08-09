<script lang="ts">
    import {fly, scale} from "svelte/transition"
    import { flip } from "svelte/animate";
    import {SvelteSet} from "svelte/reactivity";
    import type {BattleCard} from "$lib/types";

    type Card = {
        id: string;
        display_name: string;
        image: string;
        rarity: string;
        element: string;
        hp: number;
        damage: number;
    }

    type BattleLogEntry = {
        step: number;
        attacker: string;
        defender: string;
        attackerElement: Element;
        defenderElement: Element;
        baseDamage: number;
        multiplier: number;
        totalDamage: number;
        defenderOldHp: number;
        defenderNewHp: number;
        knockout: boolean;
    };

    let mode = $state<"PULL" | "DECK" | "FIGHT" | "RESULT">("PULL")

    let battleLogs = $state<BattleLogEntry[]>([]);
    let currentLogIndex = $state(0);
    let isAnimating = $state(false);
    let animationPhase = $state<'idle' | 'attacking' | 'damaging' | 'knockout' | 'complete'>('idle');
    let playerTeam = $state<BattleCard[]>([]);
    let aiTeam = $state<BattleCard[]>([]);
    let displayPlayerHp = $state<Record<string, number>>({});
    let displayAiHp = $state<Record<string, number>>({});
    const ANIM_SPEED = 1200;


    let isPulling = $state(false);
    let pulledCards = $state<Card[]>([]);
    //let showCards = $state(false);
    let flippedCards = $state<Set<string>>(new Set());
    let currentOdds = $state<any>(null);

    let selectedCards = $state<Set<string>>(new Set());
    let deckConfirmed = $state(false);
    let fightResult = $state<any>(null);


    const rarityColors: Record<string, string> = {
        common: 'from-stone-400 to-stone-500 border-stone-300',
        uncommon: 'from-green-500 to-emerald-600 border-green-300',
        rare: 'from-blue-500 to-indigo-600 border-blue-300',
        epic: 'from-purple-500 to-violet-600 border-purple-300',
        legendary: 'from-amber-400 to-yellow-500 border-yellow-200'
    };

    const rarityGlow: Record<string, string> = {
        common: 'shadow-stone-400/20',
        uncommon: 'shadow-green-400/30',
        rare: 'shadow-blue-400/40',
        epic: 'shadow-purple-400/50',
        legendary: 'shadow-yellow-400/60'
    };

    async function pullCards() {
        if (isPulling) return;
        isPulling = true;
        flippedCards = new Set(); // Reset all flips
        pulledCards = [];

        try {
            const res = await fetch('/api/items/random', {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    odds: currentOdds
                })
            });
            const data = await res.json();

            pulledCards = data.items;
            currentOdds = data.odds;

            // No more delay needed - cards appear face-down immediately
        } catch (err) {
            console.error('Pull failed:', err);
        } finally {
            isPulling = false;
        }
    }

    function toggleFlip(cardId: string) {
        const newFlipped = new SvelteSet(flippedCards);
        if (newFlipped.has(cardId)) {
            newFlipped.delete(cardId);
        } else {
            newFlipped.add(cardId);
        }
        flippedCards = newFlipped;
    }

    function toggleCardSelect(cardId: string) {
        if (deckConfirmed) return;

        const newSelected = new SvelteSet(selectedCards);
        if (newSelected.has(cardId)) {
            newSelected.delete(cardId);
        } else if (newSelected.size < 3) {
            newSelected.add(cardId);
        }
        selectedCards = newSelected;
    }

    function confirmDeck() {
        if (selectedCards.size !== 3) return;
        deckConfirmed = true;
        mode = 'FIGHT';
    }

    // Element icons/emojis
    const elementIcons: Record<string, string> = {
        water: '💧',
        fire: '🔥',
        ice: '❄️',
        air: '🌪️',
        metal: '⚙️',
        void: '🌑',
        socratic: '📜',
        tung_descendant: '⚡',
        grimble: '👁️'
    };

    async function sendFightRequest() {
        const selectedIds = [...selectedCards];
        if (selectedIds.length !== 3) {
            console.error('Must select exactly 3 cards');
            return;
        }

        // Build player cards from selected IDs
        const player = pulledCards
            .filter(c => selectedIds.includes(c.id))
            .map(({ id, display_name, element, hp, damage }) => ({
                id,
                display_name,
                element,
                hp,
                damage,
            }));

        // Pool is everything the player didn't pick
        const pool = pulledCards
            .filter(c => !selectedIds.includes(c.id))
            .map(({ id, display_name, element, hp, damage }) => ({
                id,
                display_name,
                element,
                hp,
                damage,
            }));

        try {
            const res = await fetch('/api/battle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player, pool }),
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Fight request failed: ${res.status} ${errText}`);
            }

            const battleResult = await res.json();

            // Store result for the FIGHT/RESULT screens
            fightResult = battleResult;
            mode = 'FIGHT';
            await startBattleAnimation();
            return battleResult;
        } catch (err) {
            console.error('Fight request failed:', err);
        }
    }


    async function startBattleAnimation() {
        if (!fightResult) return;

        battleLogs = fightResult.logs;
        currentLogIndex = 0;
        isAnimating = true;

        // Initialize teams
        playerTeam = fightResult.playerCards.map((c: BattleCard) => ({...c}));
        aiTeam = fightResult.aiCards.map((c: BattleCard) => ({...c}));

        // Track HP separately for smooth animation
        displayPlayerHp = {};
        displayAiHp = {};
        playerTeam.forEach(c => displayPlayerHp[c.id] = c.hp);
        aiTeam.forEach(c => displayAiHp[c.id] = c.hp);

        await runBattleSequence();
    }

    async function runBattleSequence() {
        for (let i = 0; i < battleLogs.length; i++) {
            currentLogIndex = i;
            const log = battleLogs[i];

            // Phase 1: Attacker moves in
            animationPhase = 'attacking';
            await sleep(ANIM_SPEED * 0.4);

            // Phase 2: Show damage
            animationPhase = 'damaging';
            await sleep(ANIM_SPEED * 0.3);

            // Apply damage to display HP
            const isPlayerDefender = playerTeam.some(c => c.display_name === log.defender);
            if (isPlayerDefender) {
                const defender = playerTeam.find(c => c.display_name === log.defender);
                if (defender) {
                    displayPlayerHp[defender.id] = log.defenderNewHp;
                    defender.hp = log.defenderNewHp;
                }
            } else {
                const defender = aiTeam.find(c => c.display_name === log.defender);
                if (defender) {
                    displayAiHp[defender.id] = log.defenderNewHp;
                    defender.hp = log.defenderNewHp;
                }
            }

            // Phase 3: Knockout check
            if (log.knockout) {
                animationPhase = 'knockout';
                await sleep(ANIM_SPEED * 0.5);
            }

            await sleep(ANIM_SPEED * 0.3);
        }

        animationPhase = 'complete';
        isAnimating = false;
    }

    function sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function getAttackerSide(log: BattleLogEntry): 'player' | 'ai' {
        return playerTeam.some(c => c.display_name === log.attacker) ? 'player' : 'ai';
    }

    function isKnockedOut(card: BattleCard, side: 'player' | 'ai'): boolean {
        const hp = side === 'player' ? displayPlayerHp[card.id] : displayAiHp[card.id];
        return hp !== undefined && hp <= 0;
    }

    function getHpPercent(card: BattleCard, side: 'player' | 'ai'): number {
        const current = side === 'player' ? displayPlayerHp[card.id] : displayAiHp[card.id];
        const max = fightResult.playerCards.concat(fightResult.aiCards)
            .find((c: BattleCard) => c.id === card.id)?.hp || 100;
        return Math.max(0, (current / max) * 100);
    }

</script>

<style>
    .preserve-3d {
        transform-style: preserve-3d;
    }

    .backface-hidden {
        backface-visibility: hidden;
    }

    .rotate-y-180 {
        transform: rotateY(180deg);
    }

    .flipped .rotate-y-180 {
        transform: rotateY(0deg);
    }

    .flipped .backface-hidden:first-child {
        transform: rotateY(180deg);
    }

    .preserve-3d > div {
        transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
        20%, 40%, 60%, 80% { transform: translateX(4px); }
    }

    .animate-shake {
        animation: shake 0.4s ease-in-out;
    }
</style>

<div class="h-[100vh] w-[100vw] flex flex-col bg-gradient-to-b from-stone-800 to-stone-900 overflow-hidden text-stone-300">
    <div class="w-[100vw] h-[5rem] text-xl bg-stone-800 text-center justify-center items-center flex ">GAMBLINGMAXXER6000</div>

        <!--asdfhkahsfdlkjhsalkfha

        - pull screen with cool animation
        - deck select screen
        - fight animation screen
        - result screen that caches the current odds and results


        -->

    <main class="flex-1 mt-[3rem]">
        {#if (mode === "PULL")}
            <div class="h-full flex flex-col items-center justify-start gap-8 transition-all">
                <button onclick={pullCards} disabled={isPulling} class="relative group cursor-pointer">
                    <span class="absolute inset-0 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></span>
                    <span class="relative px-12 py-6 bg-gradient-to-r from-amber-500 to-yellow-400 rounded-2xl text-black font-black text-2xl transform transition-all hover:scale-105 active:scale-95">
                        {#if isPulling}
							<!--
                            <span class="flex items-center gap-3">
                                <span class="inline-block w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
								PULLING...
							</span>
							-->
                            pulling...
                        {:else}
                            gamblecore: pull x10
                        {/if}
                    </span>
                </button>
                <!--cardgrid-->

                {#if pulledCards.length > 0}
                    <div class="grid grid-cols-5 gap-4 px-8 max-w-6xl w-full">
                        {#each pulledCards as card, i (i)}
                            <div
                                    class="relative aspect-[2/3] transform transition-all duration-500 cursor-pointer hover:scale-110 hover:z-10"
                                    style="transition-delay: {i * 50}ms"
                                    transition:fly={{duration: 500, delay: i * 50}}
                                    onclick={() => toggleFlip(card.id)}
                            >
                                <!-- Card Container with Flip -->
                                <div class="relative w-full h-full preserve-3d" class:flipped={flippedCards.has(card.id)}>
                                    <!-- Back of Card -->
                                    <div class="absolute inset-0 backface-hidden rounded-xl bg-gradient-to-br from-stone-600 to-stone-800 border-2 border-stone-500 shadow-2xl flex items-center justify-center">
                                        <!--
                                        <div class="text-4xl opacity-50">🂠</div>-->

                                        <div class="absolute bottom-2 text-[10px] text-stone-400">click to reveal</div>
                                    </div>

                                    <!-- Front of Card -->
                                    <div class="absolute inset-0 backface-hidden rounded-xl bg-gradient-to-br {rarityColors[card.rarity] || rarityColors.common} shadow-2xl {rarityGlow[card.rarity] || rarityGlow.common} flex flex-col rotate-y-180">
                                        {#if card.image}
                                            <img src={card.image} alt={card.display_name} class="w-full h-full object-cover" />
                                        {:else}
                                            <div class="text-3xl opacity-40">{elementIcons[card.element] || '🃏'}</div>
                                        {/if}
                                        <!--
                                        <div class="absolute top-2 right-2 text-2xl">
                                            {elementIcons[card.element] || '❓'}
                                        </div>

                                        <div class="flex-1 rounded-lg bg-black/20 mb-2 flex items-center justify-center overflow-hidden">
                                            {#if card.image}
                                                <img src={card.image} alt={card.display_name} class="w-full h-full object-cover" />
                                            {:else}
                                                <div class="text-3xl opacity-40">{elementIcons[card.element] || '🃏'}</div>
                                            {/if}
                                        </div>

                                        <div class="text-xs font-bold text-center text-white drop-shadow-lg truncate">
                                            {card.display_name}
                                        </div>

                                        <div class="flex justify-between text-[10px] text-white/80 mt-1">
                                            <span>❤️ {card.hp}</span>
                                            <span>⚔️ {card.damage}</span>
                                        </div>

                                        <div class="absolute top-2 left-2 text-[10px] font-medium bg-black/30 rounded px-1.5 py-0.5 text-white/70">
                                            {card.rarity}
                                        </div>
                                        -->
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>

                    <!-- Action Button -->
                    <button
                            onclick={() => mode = 'DECK'}
                            class="px-8 py-3 bg-stone-700 hover:bg-stone-600 rounded-xl font-bold transition-colors"
                    >
                        Select Your Deck ->
                    </button>
                {/if}

            </div>
        {:else if mode === 'DECK'}
            <div class="h-full flex flex-col items-center justify-center gap-8 p-8">
                <!-- Selected Cards Showcase -->
                <div class="flex gap-6 h-64 items-end">
                    {#each Array(3) as _, slot (slot)}
                        {#if [...selectedCards][slot]}
                            {@const card = pulledCards.find(c => c.id === [...selectedCards][slot])}
                            {#if card}
                                <div class="aspect-[2/3] h-full rounded-xl bg-gradient-to-br {rarityColors[card.rarity] || rarityColors.common} border-2 shadow-2xl {rarityGlow[card.rarity] || rarityGlow.common} flex flex-col p-3 transition-all duration-300 hover:scale-105 cursor-pointer"
                                     onclick={() => toggleCardSelect(card.id)}
                                >
                                    <div class="absolute -top-2 -right-2 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center text-black font-black text-xs z-10">
                                        {slot + 1}
                                    </div>
                                    <div class="absolute top-2 right-2 text-lg">
                                        {elementIcons[card.element] || '❓'}
                                    </div>
                                    <div class="flex-1 rounded-lg bg-black/20 m-1 flex items-center justify-center overflow-hidden">
                                        {#if card.image}
                                            <img src={card.image} alt={card.display_name} class="w-full h-full object-cover rounded" />
                                        {:else}
                                            <div class="text-2xl opacity-40">{elementIcons[card.element] || '🃏'}</div>
                                        {/if}
                                    </div>
                                    <div class="text-[10px] font-bold text-center text-white drop-shadow-lg leading-tight">
                                        {card.display_name}
                                    </div>
                                    <div class="flex justify-center gap-3 text-[9px] text-white/70 mt-0.5">
                                        <span>❤️ {card.hp}</span>
                                        <span>⚔️ {card.damage}</span>
                                    </div>
                                    <div class="absolute top-2 left-2 text-[8px] font-black uppercase bg-black/30 rounded px-1 py-0.5 text-white/70">
                                        {card.rarity}
                                    </div>
                                </div>
                            {/if}
                        {:else}
                            <!-- Empty Slot -->
                            <div class="aspect-[2/3] h-full rounded-xl border-2 border-dashed border-stone-600 bg-stone-800/50 flex items-center justify-center">
                                <div class="text-4xl text-stone-600 opacity-30">+</div>
                            </div>
                        {/if}
                    {/each}
                </div>

                <!-- Selection Counter -->
                <div class="text-center">
                    <p class="text-lg font-bold {selectedCards.size === 3 ? 'text-amber-400' : 'text-stone-400'}">
                        {selectedCards.size} / 3 Selected
                    </p>
                    {#if selectedCards.size === 3}
                        <p class="text-sm text-amber-400/70">Ready for battle!</p>
                    {/if}
                </div>

                <!-- Card Selection Row -->
                <div class="flex gap-3 justify-center flex-wrap max-w-5xl">
                    {#each pulledCards as card (card)}
                        <button
                                onclick={() => toggleCardSelect(card.id)}
                                disabled={selectedCards.size >= 3 && !selectedCards.has(card.id)}
                                class="relative aspect-[2/3] h-44 rounded-xl bg-gradient-to-br {rarityColors[card.rarity] || rarityColors.common} border-2 transition-all
						{selectedCards.has(card.id)
							? 'ring-4 ring-amber-400 scale-105 shadow-2xl shadow-amber-400/50 -translate-y-2'
							: selectedCards.size >= 3
								? 'opacity-30 grayscale cursor-not-allowed'
								: 'opacity-80 hover:opacity-100 hover:scale-105 hover:-translate-y-1'}"
                        >
                            {#if selectedCards.has(card.id)}
                                <div class="absolute -top-2 -right-2 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center text-black font-black text-xs z-10">
                                    ✓
                                </div>
                            {/if}

                            <div class="absolute top-1.5 right-1.5 text-base">
                                {elementIcons[card.element] || '❓'}
                            </div>

                            <div class="flex-1 rounded bg-black/20 m-1.5 flex items-center justify-center overflow-hidden" style="height: calc(100% - 3.5rem)">
                                {#if card.image}
                                    <img src={card.image} alt={card.display_name} class="w-full h-full object-cover rounded" />
                                {:else}
                                    <div class="text-lg opacity-40">{elementIcons[card.element] || '🃏'}</div>
                                {/if}
                            </div>

                            <div class="text-[10px] font-bold text-white drop-shadow-lg absolute bottom-7 left-0 right-0 text-center px-1 leading-tight">
                                {card.display_name}
                            </div>

                            <div class="absolute bottom-1.5 left-0 right-0 flex justify-center gap-2 text-[9px] text-white/70">
                                <span>❤️ {card.hp}</span>
                                <span>⚔️ {card.damage}</span>
                            </div>

                            <div class="absolute top-1.5 left-1.5 text-[8px] font-black uppercase bg-black/30 rounded px-1 py-0.5 text-white/70">
                                {card.rarity}
                            </div>
                        </button>
                    {/each}
                </div>

                <!-- Action Buttons -->
                <div class="flex gap-4 mt-2">
                    <button
                            onclick={() => mode = 'PULL'}
                            class="px-6 py-3 bg-stone-700 hover:bg-stone-600 rounded-xl font-bold transition-colors"
                    >
                        ← Pull Again
                    </button>
                    <button
                            onclick={sendFightRequest}
                            disabled={selectedCards.size !== 3}
                            class="px-10 py-3 rounded-xl font-black text-lg transition-all
					{selectedCards.size === 3
						? 'bg-gradient-to-r from-red-500 to-orange-500 text-white hover:scale-105 shadow-lg shadow-red-500/30 cursor-pointer'
						: 'bg-stone-700 text-stone-500 cursor-not-allowed'}"
                    >
                        ⚔️ FIGHT!
                    </button>
                </div>
            </div>
        {:else if mode === 'FIGHT'}
            <div class="h-full flex flex-col items-center gap-6 p-8">
                <!-- Battle Arena -->
                <div class="flex-1 w-full flex items-center justify-between max-w-6xl gap-16">

                    <!-- Player Team -->
                    <div class="flex flex-col gap-4 items-center">
                        <h3 class="text-lg font-bold text-blue-400">Your Team</h3>
                        <div class="flex gap-3">
                            {#each playerTeam as card}
                                {@const knocked = isKnockedOut(card, 'player')}
                                {@const isAttacker = currentLogIndex < battleLogs.length &&
                                    battleLogs[currentLogIndex].attacker === card.display_name}
                                {@const isDefender = currentLogIndex < battleLogs.length &&
                                    battleLogs[currentLogIndex].defender === card.display_name}

                                <div class="relative aspect-[2/3] w-36 rounded-xl bg-gradient-to-br {rarityColors[card.rarity] || rarityColors.common} border-2 transition-all duration-300
							{knocked ? 'opacity-30 grayscale scale-90' : ''}
							{isAttacker && animationPhase === 'attacking' ? 'scale-110 -translate-y-4 shadow-2xl shadow-yellow-400/50 z-10' : ''}
							{isDefender && animationPhase === 'damaging' ? 'animate-shake shadow-2xl shadow-red-500/50' : ''}
							{isDefender && animationPhase === 'knockout' ? 'opacity-0 scale-75 rotate-12' : ''}"
                                >
                                    <!-- HP Bar -->
                                    <div class="absolute -bottom-3 left-2 right-2 h-2 bg-stone-700 rounded-full overflow-hidden">
                                        <div
                                                class="h-full transition-all duration-500 rounded-full {getHpPercent(card, 'player') > 50 ? 'bg-green-400' : getHpPercent(card, 'player') > 25 ? 'bg-yellow-400' : 'bg-red-400'}"
                                                style="width: {getHpPercent(card, 'player')}%"
                                        />
                                    </div>

                                    <div class="absolute top-2 right-2 text-base">
                                        {elementIcons[card.element] || '❓'}
                                    </div>

                                    <div class="flex-1 rounded bg-black/20 m-1.5 flex items-center justify-center">
                                        <div class="text-xl opacity-40">{elementIcons[card.element] || '🃏'}</div>
                                    </div>

                                    <div class="text-[10px] font-bold text-white text-center mb-1">
                                        {card.display_name}
                                    </div>

                                    <div class="text-[10px] text-white/60 text-center mb-2">
                                        {displayPlayerHp[card.id] ?? card.hp} HP
                                    </div>

                                    {#if knocked}
                                        <div class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                                            <span class="text-2xl font-black text-red-400">💀</span>
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>

                    <!-- VS -->
                    <div class="text-4xl font-black text-stone-600 animate-pulse">
                        ⚔️
                    </div>

                    <!-- AI Team -->
                    <div class="flex flex-col gap-4 items-center">
                        <h3 class="text-lg font-bold text-red-400">AI Team</h3>
                        <div class="flex gap-3">
                            {#each aiTeam as card}
                                {@const knocked = isKnockedOut(card, 'ai')}
                                {@const isAttacker = currentLogIndex < battleLogs.length &&
                                    battleLogs[currentLogIndex].attacker === card.display_name}
                                {@const isDefender = currentLogIndex < battleLogs.length &&
                                    battleLogs[currentLogIndex].defender === card.display_name}

                                <div class="relative aspect-[2/3] w-36 rounded-xl bg-gradient-to-br {rarityColors[card.rarity] || rarityColors.common} border-2 transition-all duration-300
							{knocked ? 'opacity-30 grayscale scale-90' : ''}
							{isAttacker && animationPhase === 'attacking' ? 'scale-110 -translate-y-4 shadow-2xl shadow-yellow-400/50 z-10' : ''}
							{isDefender && animationPhase === 'damaging' ? 'animate-shake shadow-2xl shadow-red-500/50' : ''}
							{isDefender && animationPhase === 'knockout' ? 'opacity-0 scale-75 rotate-12' : ''}"
                                >
                                    <!-- HP Bar -->
                                    <div class="absolute -bottom-3 left-2 right-2 h-2 bg-stone-700 rounded-full overflow-hidden">
                                        <div
                                                class="h-full transition-all duration-500 rounded-full {getHpPercent(card, 'ai') > 50 ? 'bg-green-400' : getHpPercent(card, 'ai') > 25 ? 'bg-yellow-400' : 'bg-red-400'}"
                                                style="width: {getHpPercent(card, 'ai')}%"
                                        />
                                    </div>

                                    <div class="absolute top-2 right-2 text-base">
                                        {elementIcons[card.element] || '❓'}
                                    </div>

                                    <div class="flex-1 rounded bg-black/20 m-1.5 flex items-center justify-center">
                                        <div class="text-xl opacity-40">{elementIcons[card.element] || '🃏'}</div>
                                    </div>

                                    <div class="text-[10px] font-bold text-white text-center mb-1">
                                        {card.display_name}
                                    </div>

                                    <div class="text-[10px] text-white/60 text-center mb-2">
                                        {displayAiHp[card.id] ?? card.hp} HP
                                    </div>

                                    {#if knocked}
                                        <div class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                                            <span class="text-2xl font-black text-red-400">💀</span>
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>

                <!-- Battle Log -->
                <div class="w-full max-w-2xl bg-stone-800/50 rounded-xl p-4 backdrop-blur">
                    <div class="flex items-center justify-between mb-2">
                        <h4 class="text-sm font-bold text-stone-400 uppercase tracking-wider">Battle Log</h4>
                        {#if animationPhase === 'complete'}
                            <span class="text-xs font-bold text-amber-400">BATTLE ENDED</span>
                        {:else}
                            <span class="text-xs text-stone-500">Step {currentLogIndex + 1} / {battleLogs.length}</span>
                        {/if}
                    </div>

                    <div class="h-32 overflow-y-auto space-y-1 text-sm font-mono">
                        {#each battleLogs.slice(0, currentLogIndex + 1) as log, i}
                            <div class="flex items-center gap-2 p-1.5 rounded {i === currentLogIndex ? 'bg-amber-400/10 border border-amber-400/30' : ''}">
                                <span class="text-stone-500 text-xs w-8">#{log.step}</span>
                                <span class="text-blue-400 font-bold">{log.attacker}</span>
                                <span class="text-stone-500">→</span>
                                <span class="text-red-400 font-bold">{log.defender}</span>
                                <span class="text-stone-500 text-xs">
							({log.baseDamage} × {log.multiplier.toFixed(1)} = {log.totalDamage})
						</span>
                                {#if log.knockout}
                                    <span class="text-red-500 font-black text-xs ml-auto">KO!</span>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>

                <!-- End Battle Button -->
                {#if animationPhase === 'complete'}
                    <button
                            onclick={() => mode = 'RESULT'}
                            class="px-8 py-3 bg-gradient-to-r from-amber-500 to-yellow-400 rounded-xl text-black font-black hover:scale-105 transition-transform"
                    >
                        {fightResult?.victory ? '🏆 VICTORY! Continue →' : '💀 Defeat... Continue →'}
                    </button>
                {/if}
            </div>

        {:else if (mode === "RESULT")}
            <div>

            </div>
        {/if}
    </main>
</div>

