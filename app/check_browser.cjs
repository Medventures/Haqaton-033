// Pass an existing playwright-core installation as argv[2]; no added dependency.
const { chromium } = require(process.argv[2]);
const assert = require('node:assert/strict');
const baseURL = process.env.APP_URL || 'http://localhost:8000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(baseURL);
    await page.locator('input[name="sex"][value="F"]').check();
    await page.locator('#birth_date').fill('1984-01-01');
    await page.locator('#checkup_year').fill('2026');
    await page.locator('#next').click();
    await page.locator('input[name="urgent"][value="none"]').check();
    await page.locator('#next').click();
    await page.locator('input[name="conditions"][value="diabetes"]').check();
    await page.locator('#next').click();
    for (let i = 0; i < 3; i++) await page.locator('#skip').click();

    let release;
    const waiting = new Promise((resolve) => { release = resolve; });
    let captured;
    await page.route('**/recommendations', async (route) => {
      captured = route.request().postDataJSON();
      await waiting;
      await route.continue();
    });
    await page.locator('#recommend').click();
    await page.getByRole('status').filter({ hasText: 'Проверяем ответы' }).waitFor();
    assert.equal(await page.locator('#recommend').isDisabled(), true);
    assert.equal(await page.locator('#restart').isDisabled(), true);
    assert.equal(await page.locator('.loading-spinner').isVisible(), true);
    release();
    await page.locator('#result-title').waitFor();
    assert.equal(await page.locator('#review').isHidden(), true);
    assert.equal(await page.locator('#patient-form').isHidden(), true);
    assert.equal(await page.locator('#results-screen').isVisible(), true);
    assert.match(await page.locator('#result-title').innerText(), /Женский расширенный/);
    assert.equal(captured.birth_year, 1984);
    assert.deepEqual(captured.conditions, ['diabetes']);
    assert.match(await page.locator('#recommendation').innerText(), /Бесплатные скрининги/);
    assert.match(await page.locator('#recommendation').innerText(), /эндокринолога/);
    await page.screenshot({ path: 'app/recommendation-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: 'app/recommendation-mobile.png', fullPage: true });

    const packageTitle = await page.locator('#result-title').innerText();
    await page.locator('#package-proceed').click();
    assert.equal(await page.locator('#results-screen').isHidden(), true);
    assert.equal(await page.locator('#itinerary-screen').isVisible(), true);
    assert.equal(await page.locator('#step-title').innerText(), 'Маршрут на один день');
    assert.match(await page.locator('#itinerary-screen').innerText(), /время и кабинеты условные/);
    assert.equal(await page.locator('#itinerary-content .package-card h3').innerText(), packageTitle);
    assert.ok(await page.locator('.route-stop').count() > 2);
    assert.equal(await page.locator('.advance-preparation [data-preparation="pr_colon"]').isVisible(), true);
    assert.equal(await page.locator('.route-stop').filter({ has: page.getByRole('heading', { name: 'Анализы', exact: true }) }).locator('[data-preparation="pr_blood"]').isVisible(), true);
    assert.equal(await page.locator('.route-stop').filter({ has: page.getByRole('heading', { name: 'Эндоскопия', exact: true }) }).locator('[data-preparation="pr_gastro"]').isVisible(), true);
    assert.equal(await page.locator('.route-stop').last().locator('[data-preparation="pr_anesthesia"]').isVisible(), true);
    assert.equal(await page.locator('#itinerary-content [data-preparation="pr_thinners"]').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: 'app/itinerary-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.screenshot({ path: 'app/itinerary-desktop.png', fullPage: true });
    await page.locator('#itinerary-back').click();
    assert.equal(await page.locator('#result-title').innerText(), packageTitle);
    assert.equal(await page.locator('#itinerary-screen').isHidden(), true);
    await page.locator('#results-back').click();
    assert.equal(await page.locator('#review').isVisible(), true);
    assert.equal(await page.locator('#results-screen').isHidden(), true);
    await page.unroute('**/recommendations');
    await page.route('**/recommendations', (route) => route.abort());
    await page.locator('#recommend').click();
    await page.locator('#recommend-error').waitFor();
    assert.equal(await page.locator('#recommend').isEnabled(), true);
    assert.equal(await page.locator('#recommendation').isHidden(), true);
    await page.unroute('**/recommendations');
    await page.locator('#recommend').click();
    await page.locator('#result-title').waitFor({ state: 'visible' });
    await page.locator('#results-back').click();
    await page.locator('[data-edit="0"]').click();
    await page.locator('input[name="sex"][value="M"]').check();
    for (let i = 0; i < 6; i++) await page.locator('#next').click();
    assert.equal(await page.locator('#recommendation').isHidden(), true);
    await page.locator('#recommend').click();
    await page.locator('#result-title').waitFor();
    assert.match(await page.locator('#result-title').innerText(), /Мужской расширенный/);
    await page.locator('#package-proceed').click();
    assert.match(await page.locator('#itinerary-content .package-card h3').innerText(), /Мужской расширенный/);
    assert.equal(await page.locator('#itinerary-content').getByText('Консультация гинеколога', { exact: true }).count(), 0);
    await page.locator('#itinerary-back').click();
    await page.locator('#package-edit').click();
    assert.equal(await page.locator('#review').isVisible(), true);
    assert.deepEqual(errors, []);

    const invalid = await page.request.post(`${baseURL}/recommendations`, { data: { sex: 'X' } });
    assert.equal(invalid.status(), 422);
    const urgent = await page.request.post(`${baseURL}/recommendations`, {
      data: { sex: 'F', birth_date: '1984-01-01', urgent: 'chest_pain' },
    });
    const urgentData = await urgent.json();
    assert.equal(urgentData.package, null);
    assert.equal(urgentData.red_flags.length, 1);
    console.log('Browser checks passed: submission, loading, results, mobile, itinerary, back/edit navigation, failure/retry, API validation and urgent guard.');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
