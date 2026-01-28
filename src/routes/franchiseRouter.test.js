const request = require('supertest');
const app = require('../service');

let adminAuthToken;
let admin;
let franchiseId;
const { Role, DB } = require('../database/database.js');

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
    let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = user.name + '@adminTest.com';

    user = await DB.addUser(user);
    return { ...user, password: 'toomanysecrets' };
}

beforeAll(async () => {
    // make email unique per test run
    const testAdmin = createAdminUser();
    admin = await testAdmin

    // login admin user
    const loginRes = await request(app).put('/api/auth').send(admin);
    adminAuthToken = loginRes.body.token;

    // create a franchise to use in tests
    const franchiseRes = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send({
            name: randomName(),
            admins: [{ email: admin.email }],
        });
    franchiseId = franchiseRes.body.id;
    expect(franchiseRes.status).toBe(200);
});

test('get franchises', async () => {
    const franchiseList = await request(app).get('/api/franchise?page=0&limit=10&name=*');
    expect(franchiseList.status).toBe(200);
    expect(Array.isArray(franchiseList.body.franchises)).toBe(true);
    expect(franchiseList.body.franchises.length).toBeGreaterThan(0);
});

test('get user franchises', async () => {
    const franchiseList = await request(app).get(`/api/franchise/${admin.id}`).set('Authorization', `Bearer ${adminAuthToken}`);
    expect(franchiseList.status).toBe(200);
});

test('delete franchise', async () => {
    const deleteFranchiseRes = await request(app).delete(`/api/franchise/${franchiseId}`).set('Authorization', `Bearer ${adminAuthToken}`);
    expect(deleteFranchiseRes.status).toBe(200);
});

test('create franchise store', async () => {
    const franchiseRes = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send({
            name: randomName(),
            admins: [{ email: admin.email }],
        });
    franchiseId = franchiseRes.body.id;
    const store = { name: randomName() };
    const createStore = await request(app).post(`/api/franchise/${franchiseId}/store`).set('Authorization', `Bearer ${adminAuthToken}`).send(store);
    expect(createStore.status).toBe(200);
});