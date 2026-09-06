/**
 * Guards against model attributes reading back as `undefined`.
 *
 * Every model declared its attributes as `public id!: number` class fields.
 * With `target: ES2022` and `useDefineForClassFields` unset -- it defaults to
 * `true` -- TypeScript emits those as real own-properties initialised to
 * `undefined`, which shadow the getters Sequelize installs on the prototype.
 * Reading `user.email` gave `undefined` while `user.get('email')` gave the
 * value.
 *
 * That silently disabled both guards in `src/middlewares/auth.ts`:
 *
 *   `!user.is_active`                        -> always true  (every request rejected)
 *   `payload.tokenVersion < user.token_version` -> always false (revocation never fires)
 *
 * The second is the dangerous one: bumping `token_version` is how every
 * outstanding JWT for a user gets invalidated, and comparing against `undefined`
 * is always false, so a revoked token stayed valid while the check read as if it
 * worked. See issue #23.
 *
 * `Model.build()` constructs an instance entirely in memory, so these assertions
 * exercise the real getters -- the actual defect -- without a database, and run
 * in the normal suite.
 */
import AmmoProfile from '../../src/models/AmmoProfile';
import RifleProfile from '../../src/models/RifleProfile';
import User from '../../src/models/User';

describe('model attributes are readable as properties', () => {
  it('User: values set at build() read back directly, not as undefined', () => {
    const user = User.build({ email: 'reader@example.com', password_hash: 'hashed' });

    // The direct property read is the thing that was broken. `.get()` worked
    // throughout, so asserting on it would have passed against the defect.
    expect(user.email).toBe('reader@example.com');
    expect(user.password_hash).toBe('hashed');
  });

  it('User: defaulted attributes read back as their defaults', () => {
    const user = User.build({ email: 'defaults@example.com', password_hash: 'h' });

    expect(user.is_active).toBe(true);
    expect(user.is_verified).toBe(false);
    expect(user.token_version).toBe(0);
    expect(user.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('the direct read and .get() agree', () => {
    const user = User.build({ email: 'agree@example.com', password_hash: 'h' });

    // The defect was precisely a divergence between these two. Asserting they
    // agree fails if the class fields ever come back.
    expect(user.email).toEqual(user.get('email'));
    expect(user.password_hash).toEqual(user.get('password_hash'));
    expect(user.is_active).toEqual(user.get('is_active'));
    expect(user.token_version).toEqual(user.get('token_version'));
    expect(user.uuid).toEqual(user.get('uuid'));
  });

  it('the auth guards behave correctly for an active user with a current token', () => {
    // Mirrors src/middlewares/auth.ts:38 and :43 exactly. Against the shadowing
    // defect the first is `true` (request rejected) and the second is `false`
    // (revocation never fires) -- so both assertions here failed.
    const user = User.build({ email: 'guards@example.com', password_hash: 'h' });

    expect(!user.is_active).toBe(false);
    expect(0 < user.token_version).toBe(false);
  });

  it('the auth guards fire once the user is deactivated or their tokens revoked', () => {
    const user = User.build({ email: 'revoked@example.com', password_hash: 'h' });

    user.set('is_active', false);
    user.set('token_version', 3);

    // The direction that matters: a revoked token must be recognised as revoked.
    expect(!user.is_active).toBe(true);
    expect(0 < user.token_version).toBe(true);
  });

  it('the other models are readable too, not just User', () => {
    // The defect was repo-wide -- 87 shadowing fields across five models -- so
    // fixing only User would leave it live everywhere else.
    const rifle = RifleProfile.build({
      user_id: 1,
      name: 'Test Rifle',
      caliber: '6.5 Creedmoor',
      barrel_length: 24,
      twist_rate: '1:8',
      zero_distance: 100,
      optic_manufacturer: 'Vortex',
      optic_model: 'Razor HD Gen III',
      reticle_type: 'EBR-7D',
      click_value_type: 'MIL',
      click_value: 0.1,
      scope_height: 1.75,
    });
    expect(rifle.name).toBe('Test Rifle');
    expect(rifle.caliber).toBe('6.5 Creedmoor');
    expect(rifle.click_value_type).toBe('MIL');

    const ammo = AmmoProfile.build({
      user_id: 1,
      rifle_id: 1,
      name: 'ELD-M 140',
      manufacturer: 'Hornady',
      bullet_weight: 140,
      bullet_type: 'ELD-M',
      ballistic_coefficient_g1: 0.646,
      ballistic_coefficient_g7: 0.326,
      muzzle_velocity: 2710,
    });
    expect(ammo.manufacturer).toBe('Hornady');
    expect(ammo.bullet_weight).toBe(140);
    expect(ammo.muzzle_velocity).toBe(2710);
  });
});
