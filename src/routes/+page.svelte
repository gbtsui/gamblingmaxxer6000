<script lang="ts">
    import {fly, scale} from "svelte/transition"
    import { flip } from "svelte/animate";

    type Card = {
        id: string;
        display_name: string;
        image: string;
        rarity: string;
        element: string;
        hp: number;
        damage: number;
    }

    let mode = $state<"PULL" | "DECK" | "FIGHT" | "RESULT">("PULL")

    let isPulling = $state(false);
    let pulledCards = $state<Card[]>([]);
    //let showCards = $state(false);
    let flippedCards = $state<Set<string>>(new Set());
    let currentOdds = $state<any>(null);

    let selectedCards = $state<Set<string>>(new Set());
    let deckConfirmed = $state(false);

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
                body: JSON.stringify({

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
        const newFlipped = new Set(flippedCards);
        if (newFlipped.has(cardId)) {
            newFlipped.delete(cardId);
        } else {
            newFlipped.add(cardId);
        }
        flippedCards = newFlipped;
    }

    function toggleCardSelect(cardId: string) {
        if (deckConfirmed) return;

        const newSelected = new Set(selectedCards);
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
                            onclick={confirmDeck}
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
        {:else if (mode === "FIGHT")}
            <div>

            </div>
        {:else if (mode === "RESULT")}
            <div>

            </div>
        {/if}
    </main>
</div>

