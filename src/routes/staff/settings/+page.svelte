<script lang="ts">
	import { getProducts, updateProduct } from './data.remote';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import { formatDollars } from '$lib/utils/format';

	let products = $derived(await getProducts());
</script>

	<PageHeader title="Settings" subtitle="Staff" />

	<div class="max-w-2xl space-y-6">
		<h2 class="text-lg font-semibold">Stripe Products</h2>
		<p class="text-sm opacity-70">
			Configure the products and pricing used for checkout. Changes to names and descriptions sync
			to Stripe automatically. Price changes take effect on the next checkout.
		</p>

		{#each products as product (product.key)}
			{@const isFee = product.key === 'fee_coverage'}
			{@const instance = updateProduct.for(product.key)}
			<Form
				remote={instance}
				successToast="{product.name} updated"
			>
				<div class="card bg-base-100 shadow">
					<div class="card-body">
						<div class="flex items-center justify-between">
							<h3 class="card-title text-base">{product.name}</h3>
							<SubmitButton
								label="Save"
								successLabel="Saved"
								errorLabel="Error"
								class="btn-sm btn-primary"
							/>
						</div>

						{#if product.stripeProductId}
							<p class="font-mono text-xs opacity-50">{product.stripeProductId}</p>
						{:else}
							<p class="text-xs opacity-50">Stripe product will be created on first checkout</p>
						{/if}

						<input type="hidden" name="key" value={product.key} />

						<div class="mt-2 grid gap-4 sm:grid-cols-2">
							<div class="form-control">
								<label class="label" for="name-{product.key}">
									<span class="label-text">Product name</span>
								</label>
								{#each instance.fields.name.issues() ?? [] as issue}
									<p class="text-sm text-error">{issue.message}</p>
								{/each}
								<input
									id="name-{product.key}"
									name="name"
									type="text"
									value={product.name}
									class="input-bordered input input-sm"
								/>
							</div>

							{#if !isFee}
								<div class="form-control">
									<label class="label" for="amount-{product.key}">
										<span class="label-text">
											Amount ({product.unitLabel ?? 'per unit'})
										</span>
									</label>
									{#each instance.fields.unitAmountCents.issues() ?? [] as issue}
										<p class="text-sm text-error">{issue.message}</p>
									{/each}
									<label class="input-bordered input input-sm flex items-center gap-1">
										<span class="opacity-60">$</span>
										<input
											id="amount-{product.key}"
											type="number"
											step="0.01"
											min="0"
											value={formatDollars(product.unitAmountCents)}
											oninput={(e) => {
												const input = e.target as HTMLInputElement;
												const dollars = parseFloat(input.value);
												const hidden = input
													.closest('form')
													?.querySelector<HTMLInputElement>('[name="unitAmountCents"]');
												if (hidden && !isNaN(dollars))
													hidden.value = String(Math.round(dollars * 100));
											}}
											class="grow bg-transparent outline-none"
										/>
									</label>
									<input type="hidden" name="unitAmountCents" value={product.unitAmountCents} />
								</div>
							{:else}
								<!-- Fee coverage amount is computed per-checkout, not configurable -->
								<input type="hidden" name="unitAmountCents" value="0" />
							{/if}
						</div>

						<div class="form-control mt-2">
							<label class="label" for="desc-{product.key}">
								<span class="label-text">Description</span>
							</label>
							<textarea
								id="desc-{product.key}"
								name="description"
								value={product.description ?? ''}
								class="textarea-bordered textarea textarea-sm"
								rows="2"
							></textarea>
						</div>
					</div>
				</div>
			</Form>
		{/each}
	</div>


